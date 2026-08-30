import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { callOptions, checkedCall, disconnectCall, startCluster, waitForIdle } from "../fixtures/proxy-progress.mjs";

test("public progress crosses a real proxy without session affinity", { timeout: 30_000 }, async (t) => {
  const cluster = await startCluster();
  t.after(() => cluster.close());

  let progressBeforeCompletion = false;
  await checkedCall(cluster, "gated", "gated", async (message) => {
    if (message.params?.progress !== 1) return;
    assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.active, 0), 1);
    progressBeforeCompletion = true;
    await cluster.release("gated");
  });
  assert.equal(progressBeforeCompletion, true);
  const instances = await Promise.all(["a", "b", "c", "d"].map((id) => checkedCall(cluster, id)));
  assert.deepEqual([...new Set(instances)].sort(), ["one", "two"]);

  const client = new Client({ name: "proxy-independent-client", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } });
  try {
    await client.connect(new StreamableHTTPClientTransport(cluster.url));
    const progress = [];
    const result = await client.callTool({ name: "progress", arguments: { id: "sdk", mode: "normal" } },
      { onprogress: (update) => progress.push(update) });
    assert.deepEqual(progress.map((update) => update.progress), [1, 2, 3]);
    assert.equal(result.structuredContent.id, "sdk");
    assert.ok(progress.every((update) => update.message === `${result.structuredContent.instance}:sdk:stage`));
  } finally { await client.close(); }

  const json = await fetch(cluster.url, callOptions("json", "normal", { token: false }));
  assert.match(json.headers.get("content-type"), /^application\/json/);
  assert.equal((await json.json()).result.structuredContent.id, "json");

  for (const headers of [{}, { Authorization: "Bearer invalid" }]) {
    const denied = await fetch(cluster.url, callOptions("denied", "normal", { name: "signed-in", headers }));
    assert.equal(denied.status, 401);
    await denied.arrayBuffer();
  }
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.protectedCalls, 0), 0);
  const signedIn = await fetch(cluster.url, callOptions("allowed", "normal", {
    name: "signed-in", headers: { Authorization: "Bearer test-valid" },
  }));
  assert.match(signedIn.headers.get("content-type"), /^application\/json/);
  assert.equal((await signedIn.json()).result.isError, false);

  const calls = (await cluster.stats()).reduce((sum, item) => sum + item.calls, 0);
  cluster.forwarding["x-forwarded-proto"] = "http";
  const rejected = await fetch(cluster.url, callOptions("bad-forwarding"));
  assert.equal(rejected.status, 403);
  await rejected.arrayBuffer();
  cluster.forwarding["x-forwarded-proto"] = "https";
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.calls, 0), calls);

  for (const mode of ["event-size", "event-count", "result-size", "timeout"]) {
    await checkedCall(cluster, mode, mode);
  }
  await waitForIdle(cluster, 1);

  await disconnectCall(cluster, "disconnect");
  await waitForIdle(cluster, 2);
});
