import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DatabaseSync } from "node:sqlite";

const serverPath = fileURLToPath(
  new URL("../dist/server.js", import.meta.url),
);
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "multi-instance-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("two server processes share one atomic report store", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-multi-instance-test-"));
  const databasePath = join(directory, "reports.sqlite");
  const first = await startInstance("instance-a", databasePath);
  const second = await startInstance("instance-b", databasePath);
  const firstClient = await connect(first.url);
  const secondClient = await connect(second.url);
  t.after(async () => {
    try {
      await Promise.allSettled([firstClient.close(), secondClient.close()]);
      await Promise.all([stopInstance(first.child), stopInstance(second.child)]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  const localRace = await Promise.all(Array.from({ length: 6 }, () => (
    createReport(firstClient, "single-instance-race")
  )));
  assert.equal(new Set(localRace.map(({ reportId }) => reportId)).size, 1);
  assert.equal(reportCount(databasePath, "single-instance-race"), 1);

  const [fromFirst, fromSecond] = await Promise.all([
    createReport(firstClient, "shared-instance-race"),
    createReport(secondClient, "shared-instance-race"),
  ]);
  assert.deepEqual(fromFirst, fromSecond);
  assert.match(fromFirst.createdByInstance, /^instance-[ab]$/);
  assert.deepEqual(fromFirst.peaTypeCounts, { shelling: 2, snap: 2 });
  assert.equal(fromFirst.totalPlants, 4);
  assert.equal(reportCount(databasePath, "shared-instance-race"), 1);

  const replay = await createReport(
    fromFirst.createdByInstance === "instance-a" ? secondClient : firstClient,
    "shared-instance-race",
  );
  assert.deepEqual(replay, fromFirst);

  const alternating = await Promise.all([
    createReport(firstClient, "alternating-a"),
    createReport(secondClient, "alternating-b"),
  ]);
  assert.notEqual(alternating[0].reportId, alternating[1].reportId);

  const raw = await rawCreateReport(first.url, "raw-http-report");
  assert.equal(raw.response.status, 200);
  assert.equal(raw.body.result.isError, false);
  assert.equal(raw.body.result.structuredContent.requestId, "raw-http-report");
  assert.equal(totalReportCount(databasePath), 5);

  await closeProvider(first.child);
  const unavailable = await rawCreateReport(first.url, "must-not-be-created");
  assert.equal(unavailable.response.status, 200);
  assert.equal(unavailable.body.result.content[0].text, "Tool execution failed");
  assert.doesNotMatch(JSON.stringify({ ...unavailable.body.result, _meta: undefined }), /sqlite|database|closed|provider/i);
  assert.equal(reportCount(databasePath, "must-not-be-created"), 0);

  const independent = await firstClient.callTool({ name: "describe-instance", arguments: {} });
  assert.deepEqual(independent.structuredContent, { instanceName: "instance-a" });
  const readiness = await fetch(new URL("/readyz", first.url));
  assert.equal(readiness.status, 200);
  assert.equal(await readiness.text(), "ready\n");

  const secondStillWorks = await createReport(secondClient, "provider-b-still-works");
  assert.equal(secondStillWorks.requestId, "provider-b-still-works");
});

test("an unavailable SQLite provider does not stop independent server features", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-multi-instance-missing-"));
  const instance = await startInstance(
    "unavailable-before-start",
    join(directory, "missing", "reports.sqlite"),
  );
  const client = await connect(instance.url);
  t.after(async () => {
    await client.close();
    await stopInstance(instance.child);
    await rm(directory, { recursive: true, force: true });
  });

  const listed = await client.listTools();
  assert.ok(listed.tools.some(({ name }) => name === "create-shared-harvest-report"));
  assert.deepEqual(
    (await client.callTool({ name: "describe-instance", arguments: {} })).structuredContent,
    { instanceName: "unavailable-before-start" },
  );
  const unavailable = await rawCreateReport(instance.url, "provider-never-opened");
  assert.equal(unavailable.body.result.content[0].text, "Tool execution failed");
  assert.doesNotMatch(JSON.stringify({ ...unavailable.body.result, _meta: undefined }), /sqlite|database|missing|provider/i);
  const readiness = await fetch(new URL("/readyz", instance.url));
  assert.equal(readiness.status, 200);
  assert.equal(await readiness.text(), "ready\n");
});

async function startInstance(instanceName, databasePath) {
  const child = fork(serverPath, [], {
    env: {
      ...process.env,
      EMSEEPEA_DATABASE: databasePath,
      EMSEEPEA_INSTANCE: instanceName,
      PORT: "0",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let errors = "";
  child.stderr.on("data", (chunk) => { errors = `${errors}${chunk}`.slice(-2_000); });
  const message = await waitForMessage(child, ({ type }) => type === "ready")
    .catch((error) => {
      throw new Error(`${error.message}: ${errors}`);
    });
  return { child, url: new URL(message.url) };
}

async function connect(url) {
  const client = new Client(
    { name: "emseepea-multi-instance-client", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

async function createReport(client, requestId) {
  const result = await client.callTool({
    name: "create-shared-harvest-report",
    arguments: { requestId },
  });
  assert.equal(result.isError, false);
  return result.structuredContent;
}

async function rawCreateReport(url, requestId) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "create-shared-harvest-report",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: "create-shared-harvest-report",
        arguments: { requestId },
        _meta: requestMeta,
      },
    }),
  });
  return { response, body: await response.json() };
}

function reportCount(databasePath, requestId) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare(
      "SELECT COUNT(*) AS count FROM reports WHERE idempotency_key = ?",
    ).get(requestId).count;
  } finally {
    database.close();
  }
}

function totalReportCount(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database.prepare("SELECT COUNT(*) AS count FROM reports").get().count;
  } finally {
    database.close();
  }
}

async function closeProvider(child) {
  const closed = waitForMessage(child, ({ type }) => type === "provider-closed");
  child.send("close-provider");
  await closed;
}

function waitForMessage(child, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("child message timed out")), 10_000);
    const onMessage = (message) => {
      if (message && typeof message === "object" && predicate(message)) finish(undefined, message);
    };
    const onExit = (code) => finish(new Error(`child exited ${code}`));
    const finish = (error, message) => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("exit", onExit);
      if (error) reject(error);
      else resolve(message);
    };
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

async function stopInstance(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2_000).then(() => assert.fail("server child did not exit after SIGTERM")),
  ]);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
