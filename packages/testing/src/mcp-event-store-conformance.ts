import { isDeepStrictEqual } from "node:util";
import type {
  McpClaimedEventDelivery,
  McpEventDelivery,
  McpEventStore,
  McpEventSubscription,
} from "@emseepea/server";

export interface McpEventStoreConformanceHandle {
  readonly store: McpEventStore;
  close(): void | Promise<void>;
}

export interface McpEventStoreConformanceFixture {
  open(): McpEventStoreConformanceHandle | Promise<McpEventStoreConformanceHandle>;
  dispose(): void | Promise<void>;
}

export type McpEventStoreConformanceFixtureFactory = () =>
  McpEventStoreConformanceFixture | Promise<McpEventStoreConformanceFixture>;

export class McpEventStoreConformanceError extends Error {
  constructor(
    readonly code: "MISMATCH" | "INCONCLUSIVE" | "CALLBACK_FAILED",
    readonly scenario: string,
    detail: string,
  ) {
    super(`MCP Event store ${scenario}: ${detail}`);
    this.name = "McpEventStoreConformanceError";
  }
}

type Scenario = {
  open(): Promise<McpEventStoreConformanceHandle>;
  close(handle: McpEventStoreConformanceHandle): Promise<void>;
  call<T>(label: string, operation: () => T | Promise<T>): Promise<T>;
  check(value: boolean, detail: string): void;
  claim(store: McpEventStore, now: number): Promise<McpClaimedEventDelivery>;
};

const fixturePreviousSecret = `whsec_${Buffer.alloc(32, 2).toString("base64")}`;

/** Runs bounded synthetic checks; missing queue witnesses fail as INCONCLUSIVE. */
export async function assertMcpEventStoreConformance(
  createFixture: McpEventStoreConformanceFixtureFactory,
): Promise<void> {
  const fixtureSubscription = subscription();
  await scenario("subscriptions", createFixture, async ({ open, call, check }) => {
    const a = (await open()).store;
    const b = (await open()).store;
    const original = fixtureSubscription;
    check(await call("get absent", () => a.get(original.id)) === null, "absent subscription must be null");
    await call("put rotation", () => a.put({ ...original, verifiedUntil: original.expiresAt - 1_000,
      previousSecret: fixturePreviousSecret, previousSecretUntil: original.expiresAt - 2_000 }));
    check(isDeepStrictEqual(await call("get rotation", () => b.get(original.id)), {
      ...original, verifiedUntil: original.expiresAt - 1_000, previousSecret: fixturePreviousSecret,
      previousSecretUntil: original.expiresAt - 2_000,
    }), "rotation fields must survive a shared-storage read");
    const replacement = { ...original, name: "synthetic.replaced", arguments: { record: "replacement" } };
    await call("replace", () => b.put(replacement));
    check(isDeepStrictEqual(await call("get replacement", () => a.get(original.id)), replacement),
      "replacement must remove omitted optional fields");
    check(isDeepStrictEqual(await call("list old name", () => a.list(original.name)), []),
      "list must isolate the event name");
    check(isDeepStrictEqual(await call("list replacement", () => b.list(replacement.name)), [replacement]),
      "list must return the complete replacement");
    const variants = [original, { ...replacement, ownerKey: "synthetic-other-owner" }];
    await joined(variants.map((value, index) => () => call("race put", () => (index ? b : a).put(value))));
    const raced = await call("read race", () => a.get(original.id));
    check(variants.some((value) => isDeepStrictEqual(value, raced)), "racing puts must retain one complete record");
    const distinct = Array.from({ length: 4 }, (_, index) => ({ ...original, id: `synthetic-sub-${index}` }));
    await joined(distinct.map((value, index) => () => call("distinct put", () => (index % 2 ? b : a).put(value))));
    for (const value of distinct) check(isDeepStrictEqual(await call("read distinct", () => a.get(value.id)), value),
      "distinct concurrent writes must survive");
    await joined([() => call("race delete", () => a.delete(original.id)),
      () => call("race replacement", () => b.put(replacement))]);
    const afterDelete = await call("read delete race", () => a.get(original.id));
    check(afterDelete === null || isDeepStrictEqual(afterDelete, replacement), "put/delete race must retain a complete outcome");
    await call("delete", () => b.delete(original.id));
    check(await call("read deleted", () => a.get(original.id)) === null, "delete must be visible to another handle");
  });

  await scenario("competing claims", createFixture, async ({ open, call, check }) => {
    const a = (await open()).store;
    const b = (await open()).store;
    await call("put queue subscription", () => a.put(fixtureSubscription));
    const expected = Array.from({ length: 4 }, (_, index) => delivery(`synthetic-job-${index}`));
    for (const value of expected) await call("enqueue", () => a.enqueue(value));
    await call("enqueue future", () => a.enqueue({ ...delivery("synthetic-future"), nextAttemptAt: 10_000 }));
    const seen = new Set<string>();
    for (let round = 0; round < 8; round += 1) {
      const batches = await joined([() => call("claim A", () => a.claimDue(2, 100, 1_000)),
        () => call("claim B", () => b.claimDue(2, 100, 1_000))]);
      for (const batch of batches) {
        check(Array.isArray(batch) && batch.length <= 2, "claim must respect its limit");
        for (const value of batch) {
          check(!seen.has(value.id), "active claims must not overlap");
          const expectedValue = expected.find(({ id }) => value.id === id);
          check(expectedValue !== undefined && isDeepStrictEqual(withoutLease(value), expectedValue),
            "claim must retain an eligible queued record");
          check(typeof value.leaseId === "string" && value.leaseId.length > 0, "claim must carry a lease token");
          seen.add(value.id);
        }
      }
    }
    if (seen.size !== expected.length) throw new McpEventStoreConformanceError("INCONCLUSIVE", "competing claims",
      "bounded probing did not observe all synthetic queue witnesses");
  });

  for (const stale of ["complete", "reschedule"] as const) {
    await scenario(`stale ${stale}`, createFixture, async ({ open, call, check, claim }) => {
      const a = (await open()).store;
      const b = (await open()).store;
      await call("put queue subscription", () => a.put(fixtureSubscription));
      const value = delivery("synthetic-fenced");
      await call("enqueue", () => a.enqueue(value));
      const old = await claim(a, 100);
      const current = await claim(b, 201);
      check(current.leaseId !== old.leaseId, "reclaim must replace the lease token");
      check(isDeepStrictEqual(withoutLease(current), value), "reclaim must preserve every delivery field");
      // Either rejection or no-op is permitted for a stale token. Only effects are checked.
      await Promise.allSettled([Promise.resolve().then(() => stale === "complete"
        ? a.complete(old.id, old.leaseId)
        : a.reschedule({ ...old, body: "synthetic-stale-mutation", nextAttemptAt: 0 }))]);
      check(isDeepStrictEqual(await call("claim active", () => a.claimDue(1, 202, 100)), []),
        "a stale operation must not release a current claim");
      const recovered = await claim(b, 302);
      check(isDeepStrictEqual(withoutLease(recovered), value), "a stale operation must not alter the queued record");
      await call("complete current", () => b.complete(recovered.id, recovered.leaseId));
      await Promise.allSettled([Promise.resolve().then(() => a.reschedule({ ...old, nextAttemptAt: 0 }))]);
      check(isDeepStrictEqual(await call("claim completed", () => b.claimDue(1, 500, 100)), []),
        "stale reschedule must not resurrect completed work");
    });
  }

  await scenario("retry and reopen", createFixture, async ({ open, close, call, check, claim }) => {
    const first = await open();
    const value = delivery("synthetic-reopen");
    await call("put", () => first.store.put(fixtureSubscription));
    await call("enqueue", () => first.store.enqueue(value));
    const old = await claim(first.store, 100);
    await close(first);
    const next = (await open()).store;
    check(isDeepStrictEqual(await call("read reopened", () => next.get(fixtureSubscription.id)), fixtureSubscription),
      "subscription must survive graceful reopen");
    check(isDeepStrictEqual(await call("claim reopened active", () => next.claimDue(1, 199, 100)), []),
      "active lease must survive graceful reopen");
    const current = await claim(next, 201);
    check(current.leaseId !== old.leaseId, "reopened reclaim must replace the lease token");
    check(isDeepStrictEqual(withoutLease(current), value), "queued fields must survive graceful reopen");
    const retry = { ...current, attempts: current.attempts + 1, nextAttemptAt: 1_000 };
    await call("reschedule current", () => next.reschedule(retry));
    check(isDeepStrictEqual(await call("claim before retry", () => next.claimDue(1, 999, 100)), []),
      "retry must not be claimed before its due time");
    const retried = await claim(next, 1_001);
    check(isDeepStrictEqual(withoutLease(retried), withoutLease(retry)), "retry fields must roundtrip");
    await call("complete retry", () => next.complete(retried.id, retried.leaseId));
    check(isDeepStrictEqual(await call("claim completed retry", () => next.claimDue(1, 2_000, 100)), []),
      "completion must remove the queued record");
  });
}

async function scenario(
  name: string,
  createFixture: McpEventStoreConformanceFixtureFactory,
  run: (context: Scenario) => Promise<void>,
): Promise<void> {
  const handles = new Set<McpEventStoreConformanceHandle>();
  const errors: unknown[] = [];
  const call = async <T>(label: string, operation: () => T | Promise<T>): Promise<T> => {
    try { return await operation(); } catch {
      throw new McpEventStoreConformanceError("CALLBACK_FAILED", name, `${label} failed; backend details omitted`);
    }
  };
  const fixture = await call("create fixture", createFixture);
  const close = async (handle: McpEventStoreConformanceHandle) => {
    handles.delete(handle);
    await call("close handle", () => handle.close());
  };
  try {
    await run({
      async open() {
        const handle = await call("open handle", () => fixture.open());
        handles.add(handle);
        return handle;
      }, close, call,
      check(value, detail) { if (!value) throw new McpEventStoreConformanceError("MISMATCH", name, detail); },
      async claim(store, now) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const values = await call("claim witness", () => store.claimDue(1, now, 100));
          if (!Array.isArray(values) || values.length > 1) throw new McpEventStoreConformanceError("MISMATCH", name,
            "claim must respect its limit");
          if (values.length === 1) {
            const value = values[0]!;
            if (typeof value.leaseId !== "string" || value.leaseId.length === 0) {
              throw new McpEventStoreConformanceError("MISMATCH", name, "claim must carry a lease token");
            }
            return value;
          }
        }
        throw new McpEventStoreConformanceError("INCONCLUSIVE", name, "bounded probing did not observe a queue witness");
      },
    });
  } catch (error) { errors.push(error); }
  for (const handle of handles) {
    try { await close(handle); } catch (error) { errors.push(error); }
  }
  try { await call("dispose fixture", () => fixture.dispose()); } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, `MCP Event store ${name}: check and cleanup failed`);
}

async function joined<T>(operations: readonly (() => Promise<T>)[]): Promise<T[]> {
  const results = await Promise.allSettled(operations.map((operation) => Promise.resolve().then(operation)));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length === 1) throw failures[0]!.reason;
  if (failures.length > 1) throw new AggregateError(failures.map(({ reason }) => reason), "Concurrent store operations failed");
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}

function subscription(): McpEventSubscription {
  return { id: "synthetic-subscription", name: "synthetic.changed", ownerKey: "synthetic-owner",
    arguments: { record: "synthetic-record" }, url: "https://callback.example.invalid/events",
    secret: `whsec_${Buffer.alloc(32, 1).toString("base64")}`, expiresAt: Date.now() + 86_400_000 };
}

function delivery(id: string): McpEventDelivery {
  return { id, subscriptionId: "synthetic-subscription", eventId: `synthetic-event-${id}`,
    body: JSON.stringify({ synthetic: id }), attempts: 0, nextAttemptAt: 50 };
}

function withoutLease({ leaseId: _leaseId, ...value }: McpClaimedEventDelivery): McpEventDelivery {
  return value;
}
