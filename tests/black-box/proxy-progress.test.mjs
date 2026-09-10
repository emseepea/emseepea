import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  callOptions, checkMessages, checkedCall, disconnectCall, readMessages, startCluster, waitForIdle, waitForWaiting,
} from "../fixtures/proxy-progress.mjs";

test("protected progress crosses a real proxy after authorization", { timeout: 30_000 }, async (t) => {
  const cluster = await startCluster();
  t.after(() => cluster.close());
  const protectedOptions = {
    name: "protected-progress", authToken: "test-valid", expectedCaller: "client-default",
  };

  let progressBeforeCompletion = false;
  await checkedCall(cluster, "gated", "gated", async (message) => {
    if (message.params?.progress !== 1) return;
    assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.active, 0), 1);
    progressBeforeCompletion = true;
    await cluster.release("gated");
  }, protectedOptions);
  assert.equal(progressBeforeCompletion, true);
  const instances = await Promise.all(
    ["a", "b", "c", "d"].map((id) => checkedCall(cluster, id, "normal", undefined, protectedOptions)),
  );
  assert.deepEqual([...new Set(instances)].sort(), ["one", "two"]);

  const client = new Client({ name: "proxy-independent-client", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } });
  try {
    await client.connect(new StreamableHTTPClientTransport(cluster.url, {
      authProvider: { token: async () => "test-valid" },
    }));
    const progress = [];
    const result = await client.callTool({ name: "protected-progress", arguments: { id: "sdk", mode: "normal" } },
      { onprogress: (update) => progress.push(update) });
    assert.deepEqual(progress.map((update) => update.progress), [1, 2, 3]);
    assert.equal(result.structuredContent.id, "sdk");
    assert.equal(result.structuredContent.caller, "client-default");
    assert.ok(progress.every((update) =>
      update.message === `${result.structuredContent.instance}:client-default:sdk:stage`));
  } finally { await client.close(); }

  const json = await fetch(cluster.url, callOptions("json", "normal", { ...protectedOptions, token: false }));
  assert.match(json.headers.get("content-type"), /^application\/json/);
  assert.equal((await json.json()).result.structuredContent.id, "json");

  await checkedCall(cluster, "public", "normal", undefined, { name: "progress" });

  const beforeAuthentication = (await cluster.stats()).reduce((sum, item) => sum + item.calls, 0);
  let authResponseStarted = false;
  const authResponse = fetch(cluster.url, callOptions("auth-gated", "normal", {
    ...protectedOptions, authToken: "test-gated",
  })).then((response) => { authResponseStarted = true; return response; });
  await waitForWaiting(cluster, "auth");
  assert.equal(authResponseStarted, false);
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.calls, 0), beforeAuthentication);
  await cluster.release("auth");
  checkMessages(await readMessages(await authResponse), "auth-gated", "normal", "client-default");

  await Promise.all([
    ["test-alice", "client-alice"], ["test-bob", "client-bob"],
  ].map(([authToken, expectedCaller]) => checkedCall(cluster, expectedCaller, "normal", undefined, {
    name: "protected-progress", authToken, expectedCaller,
  })));

  const beforeDenied = (await cluster.stats()).reduce((sum, item) => sum + item.calls, 0);
  for (const [authToken, status] of [
    [undefined, 401], ["secret-bearer-sentinel", 401], ["expired", 401],
    ["wrong-resource", 401], ["wrong-scope", 403],
  ]) {
    const denied = await fetch(cluster.url, callOptions(`denied-${authToken ?? "missing"}`, "normal", {
      ...protectedOptions, authToken,
    }));
    assert.equal(denied.status, status);
    assert.match(denied.headers.get("content-type"), /^application\/json/);
    assert.equal(denied.headers.get("x-accel-buffering"), null);
    const body = await denied.text();
    assert.ok(Buffer.byteLength(body) < 1_024);
    if (authToken) assert.doesNotMatch(body, new RegExp(authToken));
  }
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.calls, 0), beforeDenied);

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
  const verifierCalls = (await cluster.stats()).reduce((sum, item) => sum + item.verifierCalls, 0);
  cluster.forwarding["x-forwarded-proto"] = "http";
  const rejected = await fetch(cluster.url, callOptions("bad-forwarding", "normal", protectedOptions));
  assert.equal(rejected.status, 403);
  await rejected.arrayBuffer();
  cluster.forwarding["x-forwarded-proto"] = "https";
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.calls, 0), calls);
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.verifierCalls, 0), verifierCalls);

  const slow = await fetch(cluster.url, callOptions("slow-verifier", "normal", {
    ...protectedOptions, authToken: "slow",
  }));
  assert.equal(slow.status, 500);
  assert.match(slow.headers.get("content-type"), /^application\/json/);
  assert.equal(slow.headers.get("x-accel-buffering"), null);
  await slow.arrayBuffer();
  assert.equal((await cluster.stats()).reduce((sum, item) => sum + item.calls, 0), calls);

  for (const mode of ["event-size", "event-count", "result-size", "timeout"]) {
    await checkedCall(cluster, mode, mode, undefined, protectedOptions);
  }
  await waitForIdle(cluster, 1);

  await disconnectCall(cluster, "disconnect", protectedOptions);
  await waitForIdle(cluster, 2);
});

test("shutdown cancels an active protected proxy stream", { timeout: 10_000 }, async (t) => {
  const cluster = await startCluster();
  t.after(() => cluster.close());
  const response = await fetch(cluster.url, callOptions("shutdown", "disconnect", {
    name: "protected-progress", authToken: "test-valid",
  }));
  const reader = response.body.getReader();
  assert.equal((await reader.read()).done, false);
  const stopped = await cluster.shutdown();
  assert.ok(stopped.every(({ active }) => active === 0));
  assert.equal(stopped.reduce((sum, { cancelled }) => sum + cancelled, 0), 1);
  await reader.cancel().catch(() => {});
});
