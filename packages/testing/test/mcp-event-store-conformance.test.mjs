import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openStore } from "../../../dogfood/events/store.mjs";
import { assertMcpEventStoreConformance, McpEventStoreConformanceError } from "../dist/index.js";

function memoryFixture({ defect, staleReject = false, lifecycle = [] } = {}) {
  const subscriptions = new Map();
  const queue = new Map();
  const leases = new Map();
  return {
    open() {
      let closed = false;
      const store = {
        async get(id) { return structuredClone(subscriptions.get(id) ?? null); },
        async put(value) {
          assert.ok(value.expiresAt > Date.now(), "fixture subscription must be unexpired");
          assert.match(value.secret, /^whsec_[A-Za-z0-9+/]+=*$/);
          if (value.verifiedUntil !== undefined) assert.ok(value.verifiedUntil > Date.now());
          if (value.previousSecretUntil !== undefined) assert.ok(value.previousSecretUntil > Date.now());
          // Explicit interleaving lets lost-write controls overlap within one process.
          await new Promise((resolve) => setImmediate(resolve));
          if (defect === "lost writes") subscriptions.clear();
          subscriptions.set(value.id, structuredClone(value));
        },
        async delete(id) { subscriptions.delete(id); },
        async list(name) { return structuredClone([...subscriptions.values()].filter((value) => value.name === name)); },
        async enqueue(value) {
          assert.ok(subscriptions.has(value.subscriptionId), "queue fixture must have its referenced subscription");
          queue.set(value.id, structuredClone(value));
        },
        async claimDue(limit, now, leaseMs) {
          if (defect === "no progress") return [];
          const values = [];
          for (const [id, value] of queue) {
            if (values.length >= limit) break;
            const lease = leases.get(id);
            if (value.nextAttemptAt > now || (lease && lease.until > now)) continue;
            const leaseId = randomUUID();
            if (defect !== "overlapping claims") leases.set(id, { id: leaseId, until: now + leaseMs });
            values.push({ ...structuredClone(value), leaseId });
          }
          return values;
        },
        async complete(id, leaseId) {
          if (defect !== "stale completion" && leases.get(id)?.id !== leaseId) {
            if (staleReject) throw new Error("synthetic stale lease rejection");
            return;
          }
          queue.delete(id);
          leases.delete(id);
        },
        async reschedule({ leaseId, ...value }) {
          if (defect !== "stale reschedule" && defect !== "resurrection" && leases.get(value.id)?.id !== leaseId) {
            if (staleReject) throw new Error("synthetic stale lease rejection");
            return;
          }
          if (defect === "resurrection" && queue.has(value.id) && leases.get(value.id)?.id !== leaseId) return;
          queue.set(value.id, structuredClone(value));
          leases.delete(value.id);
        },
      };
      lifecycle.push("open");
      return { store, close() {
        assert.equal(closed, false, "a handle must not be closed twice");
        closed = true;
        lifecycle.push("close");
      } };
    },
    dispose() { lifecycle.push("dispose"); },
  };
}

test("runs fresh bounded scenarios against the two-connection SQLite reference", async () => {
  let fixtures = 0;
  let disposed = 0;
  await assertMcpEventStoreConformance(async () => {
    fixtures += 1;
    const directory = await mkdtemp(join(tmpdir(), "emseepea-store-contract-"));
    return {
      open() {
        const reference = openStore(join(directory, "events.sqlite"));
        return { store: reference.subscription, close: () => reference.close() };
      },
      async dispose() { await rm(directory, { recursive: true, force: true }); disposed += 1; },
    };
  });
  assert.equal(fixtures, 5);
  assert.equal(disposed, fixtures);
});

test("accepts effect-safe stale rejection as well as stale no-op", async () => {
  for (const staleReject of [false, true]) {
    const lifecycle = [];
    await assertMcpEventStoreConformance(() => memoryFixture({ staleReject, lifecycle }));
    assert.equal(lifecycle.filter((value) => value === "dispose").length, 5);
    assert.equal(lifecycle.filter((value) => value === "open").length,
      lifecycle.filter((value) => value === "close").length);
  }
});

for (const defect of ["lost writes", "overlapping claims", "stale completion", "stale reschedule", "resurrection"]) {
  test(`rejects the deliberately defective ${defect} fixture`, async () => {
    const lifecycle = [];
    await assert.rejects(assertMcpEventStoreConformance(() => memoryFixture({ defect, lifecycle })),
      (error) => error instanceof McpEventStoreConformanceError && ["MISMATCH", "INCONCLUSIVE"].includes(error.code));
    assert.equal(lifecycle.at(-1), "dispose");
    assert.equal(lifecycle.filter((value) => value === "open").length,
      lifecycle.filter((value) => value === "close").length);
  });
}

test("missing progress is explicitly inconclusive and never a pass", async () => {
  await assert.rejects(assertMcpEventStoreConformance(() => memoryFixture({ defect: "no progress" })),
    { name: "McpEventStoreConformanceError", code: "INCONCLUSIVE", scenario: "competing claims" });
});

test("a failed second open still closes the first handle and disposes storage", async () => {
  const lifecycle = [];
  const fixture = memoryFixture({ lifecycle });
  let opens = 0;
  await assert.rejects(assertMcpEventStoreConformance(() => ({ ...fixture, open() {
    opens += 1;
    if (opens === 2) throw new Error("private backend details");
    return fixture.open();
  } })), { code: "CALLBACK_FAILED", scenario: "subscriptions" });
  assert.deepEqual(lifecycle, ["open", "close", "dispose"]);
});

test("a synchronous racing throw does not prevent its sibling from starting or finishing before close", async () => {
  let calls = 0;
  let pending = 0;
  let siblingFinished = false;
  await assert.rejects(assertMcpEventStoreConformance(() => {
    const fixture = memoryFixture();
    return { ...fixture, open() {
      const handle = fixture.open();
      const put = handle.store.put;
      handle.store.put = (value) => {
        calls += 1;
        if (calls === 3) throw new Error("synthetic racing failure");
        if (calls !== 4) return put(value);
        pending += 1;
        return new Promise((resolve) => setImmediate(resolve)).then(async () => {
          await put(value);
          pending -= 1;
          siblingFinished = true;
        });
      };
      return { store: handle.store, close() { assert.equal(pending, 0); handle.close(); } };
    } };
  }), { code: "CALLBACK_FAILED" });
  assert.equal(siblingFinished, true);
  assert.equal(pending, 0);
});

test("attempts all cleanup and retains primary plus cleanup failures without backend details", async () => {
  let closes = 0;
  let disposes = 0;
  const privateDetail = "private-connection-string-must-not-appear";
  await assert.rejects(assertMcpEventStoreConformance(() => ({
    open() {
      const handle = memoryFixture().open();
      return { store: { ...handle.store, get() { throw new Error(privateDetail); } },
        close() { closes += 1; throw new Error(privateDetail); } };
    },
    dispose() { disposes += 1; throw new Error(privateDetail); },
  })), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 4);
    for (const failure of error.errors) {
      assert.equal(failure.code, "CALLBACK_FAILED");
      assert.doesNotMatch(failure.stack, /private-connection-string/);
    }
    return true;
  });
  assert.equal(closes, 2);
  assert.equal(disposes, 1);
});

test("factory and dispose failures remain non-green with redacted categorical messages", async () => {
  await assert.rejects(assertMcpEventStoreConformance(() => { throw new Error("private factory detail"); }),
    { code: "CALLBACK_FAILED", scenario: "subscriptions" });
  let closes = 0;
  await assert.rejects(assertMcpEventStoreConformance(() => {
    const fixture = memoryFixture();
    return { open() { const handle = fixture.open(); return { store: handle.store,
      close() { closes += 1; handle.close(); } }; },
    dispose() { throw new Error("private dispose detail"); } };
  }), { code: "CALLBACK_FAILED" });
  assert.equal(closes, 2);
});
