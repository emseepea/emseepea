import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createExternalApprovalBroker } from "@emseepea/server/external-approval";

const proposal = {
  principalId: "synthetic-person",
  scopeId: "synthetic-organisation",
  tool: "create-record",
  input: { name: "Fictional Example", date: "2026-10-04" },
  effect: { creates: "Fictional Example", amount: 1, recipient: "example@example.invalid" },
  formSchema: { decision: ["approve", "cancel"] },
};

function fixture() {
  const rows = new Map();
  let time = 1_000;
  const key = randomBytes(32);
  const store = {
    async load(id) { return structuredClone(rows.get(id) ?? null); },
    async compareAndSwap(id, expected, replacement) {
      if (!assertEqual(rows.get(id) ?? null, expected)) return false;
      rows.set(id, structuredClone(replacement));
      return true;
    },
  };
  const options = { key, store, lifetimeMs: 60_000, maxCapsuleBytes: 8_192, now: () => time };
  return { rows, store, options, broker: createExternalApprovalBroker(options), advance: (ms) => { time += ms; } };
}

function assertEqual(a, b) {
  try { assert.deepEqual(a, b); return true; } catch { return false; }
}

test("external approval exposes the exact proposal but stores only hash metadata", async () => {
  const f = fixture();
  const { capsule, expiresAt } = await f.broker.prepare(proposal);
  assert.equal(expiresAt, 61_000);
  assert.deepEqual(await f.broker.review(capsule, proposal.principalId), proposal);
  assert.equal((await f.broker.consume(proposal)).status, "pending");
  assert.equal(f.rows.size, 1);
  for (const [id, record] of f.rows) {
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.match(record.capsuleDigest, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(record).sort(), ["capsuleDigest", "expiresAt", "state"]);
    assert.equal(record.state, "pending");
  }
  const persisted = JSON.stringify([...f.rows]);
  for (const value of [proposal.principalId, proposal.scopeId, proposal.tool, proposal.input.name, proposal.effect.recipient]) {
    assert.equal(persisted.includes(value), false);
    assert.equal(capsule.includes(value), false);
  }
});

test("approval is consumed exactly once across concurrent instances and restart", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  await f.broker.decide(capsule, proposal.principalId, "approve");
  const restarted = createExternalApprovalBroker(f.options);
  const outcomes = await Promise.all([f.broker.consume(proposal), restarted.consume(proposal)]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), ["approved", "used"]);
  assert.equal((await restarted.consume(proposal)).status, "used");
  await assert.rejects(() => restarted.decide(capsule, proposal.principalId, "approve"));
});

test("cancellation cannot be converted to approval or renewed before expiry", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  await f.broker.decide(capsule, proposal.principalId, "cancel");
  assert.equal((await f.broker.consume(proposal)).status, "cancelled");
  await assert.rejects(() => f.broker.decide(capsule, proposal.principalId, "approve"));
  await assert.rejects(() => f.broker.prepare(proposal));
  f.advance(60_000);
  const next = await f.broker.prepare(proposal);
  assert.notEqual(next.capsule, capsule);
  assert.equal((await f.broker.consume(proposal)).status, "pending");
});

test("tampered, malformed, wrong-key and wrong-person capsules do not record approval", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  const initial = structuredClone([...f.rows]);
  const parts = capsule.split(".");
  const data = Buffer.from(parts[2], "base64url");
  data[0] ^= 1;
  parts[2] = data.toString("base64url");
  for (const bad of [parts.join("."), "broken", `${capsule}.extra`, `${capsule}=`]) {
    await assert.rejects(() => f.broker.decide(bad, proposal.principalId, "approve"));
  }
  await assert.rejects(() => f.broker.decide(capsule, "other-person", "approve"));
  const otherKey = createExternalApprovalBroker({ ...f.options, key: randomBytes(32) });
  await assert.rejects(() => otherKey.review(capsule, proposal.principalId));
  assert.deepEqual([...f.rows], initial);
});

test("every material binding change prevents consumption", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  await f.broker.decide(capsule, proposal.principalId, "approve");
  for (const delta of [
    { principalId: "different-person" }, { scopeId: "different-org" }, { tool: "different-tool" },
    { input: { ...proposal.input, date: "2026-10-05" } },
    { effect: { ...proposal.effect, amount: 2 } },
    { effect: { ...proposal.effect, recipient: "other@example.invalid" } },
    { formSchema: { decision: ["approve"] } },
  ]) assert.equal((await f.broker.consume({ ...proposal, ...delta })).status, "missing");
  assert.equal((await f.broker.consume(proposal)).status, "approved");
});

test("proposal key order does not create a distinct effect", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  await f.broker.decide(capsule, proposal.principalId, "approve");
  const reordered = Object.fromEntries(Object.entries(proposal).reverse());
  reordered.input = Object.fromEntries(Object.entries(proposal.input).reverse());
  assert.equal((await f.broker.consume(reordered)).status, "approved");
});

test("expiry, including a delay inside atomic storage, prevents an approved outcome", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  await f.broker.decide(capsule, proposal.principalId, "approve");
  const compareAndSwap = f.store.compareAndSwap;
  f.store.compareAndSwap = async (...args) => { f.advance(60_000); return compareAndSwap(...args); };
  assert.equal((await f.broker.consume(proposal)).status, "expired");
  await assert.rejects(() => f.broker.review(capsule, proposal.principalId));
});

test("storage errors and lost CAS races fail closed without an approval", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  f.store.compareAndSwap = async () => false;
  await assert.rejects(() => f.broker.decide(capsule, proposal.principalId, "approve"));
  assert.equal((await f.broker.consume(proposal)).status, "pending");
  f.store.load = async () => { throw new Error("storage unavailable"); };
  await assert.rejects(() => f.broker.consume(proposal));
});

test("bounded configuration and non-JSON or oversized proposals are refused", async () => {
  const f = fixture();
  for (const delta of [{ key: randomBytes(31) }, { lifetimeMs: 0 }, { lifetimeMs: 3_600_001 }, { maxCapsuleBytes: 0 }]) {
    assert.throws(() => createExternalApprovalBroker({ ...f.options, ...delta }));
  }
  await assert.rejects(() => f.broker.prepare({ ...proposal, input: { value: NaN } }));
  await assert.rejects(() => f.broker.prepare({ ...proposal, input: { value: "x".repeat(9_000) } }));
  await assert.rejects(() => f.broker.prepare({ ...proposal, extra: true }));
  assert.equal(f.rows.size, 0);
});

test("concurrent preparations and competing decisions produce one durable transition", async () => {
  const f = fixture();
  const prepares = await Promise.allSettled([f.broker.prepare(proposal), f.broker.prepare(proposal)]);
  assert.equal(prepares.filter((r) => r.status === "fulfilled").length, 1);
  const { capsule } = prepares.find((r) => r.status === "fulfilled").value;
  const decisions = await Promise.allSettled([
    f.broker.decide(capsule, proposal.principalId, "cancel"),
    f.broker.decide(capsule, proposal.principalId, "approve"),
  ]);
  assert.equal(decisions.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await f.broker.consume(proposal)).status, "cancelled");
});

test("malformed stored metadata and invalid clocks never produce approval", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  await f.broker.decide(capsule, proposal.principalId, "approve");
  const [id, record] = [...f.rows][0];
  f.rows.set(id, { ...record, businessPayload: proposal.input });
  await assert.rejects(() => f.broker.consume(proposal));
  f.rows.set(id, record);
  const invalidClock = createExternalApprovalBroker({ ...f.options, now: () => NaN });
  await assert.rejects(() => invalidClock.consume(proposal));
  assert.equal(record.state, "approved");
});

test("expired decisions and excessively nested or cyclic proposals are refused", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  f.advance(60_000);
  await assert.rejects(() => f.broker.decide(capsule, proposal.principalId, "approve"));
  assert.equal((await f.broker.consume(proposal)).status, "expired");
  let nested = {};
  for (let i = 0; i < 40; i++) nested = { child: nested };
  await assert.rejects(() => f.broker.prepare({ ...proposal, input: nested }));
  const cyclic = {};
  cyclic.child = cyclic;
  await assert.rejects(() => f.broker.prepare({ ...proposal, input: cyclic }));
});

test("mutating constructor options cannot change the validated lifetime or size limit", async () => {
  const f = fixture();
  f.options.lifetimeMs = 72_000_000;
  f.options.maxCapsuleBytes = 131_072;
  const { expiresAt } = await f.broker.prepare(proposal);
  assert.equal(expiresAt, 61_000);
  await assert.rejects(() => f.broker.prepare({ ...proposal, input: { value: "x".repeat(9_000) } }));
});

test("private storage failures never escape any public broker method", async () => {
  const safeError = { message: "External approval is unavailable or invalid" };
  for (const method of ["prepare", "review", "decide", "consume"]) {
    const f = fixture();
    const { capsule } = await f.broker.prepare(proposal);
    f.store.load = async () => { throw new Error("synthetic-private-backend-sentinel"); };
    const invoke = method === "prepare" || method === "consume"
      ? () => f.broker[method](proposal)
      : () => f.broker[method](capsule, proposal.principalId, "approve");
    await assert.rejects(invoke, safeError);
  }
  for (const method of ["prepare", "decide", "consume"]) {
    const f = fixture();
    const { capsule } = await f.broker.prepare(proposal);
    if (method === "prepare") f.advance(60_000);
    if (method === "consume") await f.broker.decide(capsule, proposal.principalId, "approve");
    f.store.compareAndSwap = async () => { throw new Error("synthetic-private-CAS-sentinel"); };
    const invoke = method === "decide"
      ? () => f.broker.decide(capsule, proposal.principalId, "approve")
      : () => f.broker[method](proposal);
    await assert.rejects(invoke, safeError);
  }
});

test("non-boolean adapter acknowledgements cannot authorize a transition", async () => {
  const f = fixture();
  const { capsule } = await f.broker.prepare(proposal);
  f.store.compareAndSwap = async () => ({ acknowledged: true });
  await assert.rejects(() => f.broker.decide(capsule, proposal.principalId, "approve"));
  assert.equal((await f.broker.consume(proposal)).status, "pending");
});
