import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Pool } from "pg";

const serverPath = fileURLToPath(new URL("../dist/server.js", import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");
const database = new Pool({ connectionString: databaseUrl, max: 2 });
after(() => database.end());
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "multi-instance-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("two server processes share one atomic report store", async (t) => {
  const first = await startInstance("instance-a", databaseUrl);
  const second = await startInstance("instance-b", databaseUrl);
  const firstClient = await connect(first.url);
  const secondClient = await connect(second.url);
  t.after(async () => {
    await Promise.allSettled([firstClient.close(), secondClient.close()]);
    await Promise.all([stopInstance(first.child), stopInstance(second.child)]);
  });

  const localRace = await Promise.all(Array.from({ length: 6 }, () => (
    createReport(firstClient, "single-instance-race")
  )));
  assert.equal(new Set(localRace.map(({ reportId }) => reportId)).size, 1);
  assert.equal(await reportCount("single-instance-race"), 1);

  const [fromFirst, fromSecond] = await Promise.all([
    createReport(firstClient, "shared-instance-race"),
    createReport(secondClient, "shared-instance-race"),
  ]);
  assert.deepEqual(fromFirst, fromSecond);
  assert.match(fromFirst.createdByInstance, /^instance-[ab]$/);
  assert.deepEqual(fromFirst.peaTypeCounts, { shelling: 2, snap: 2 });
  assert.equal(fromFirst.totalPlants, 4);
  assert.equal(await reportCount("shared-instance-race"), 1);

  const replay = await createReport(
    fromFirst.createdByInstance === "instance-a" ? secondClient : firstClient,
    "shared-instance-race",
  );
  assert.deepEqual(replay, fromFirst);

  const raw = await rawCreateReport(first.url, "raw-http-report");
  assert.equal(raw.response.status, 200);
  assert.equal(raw.body.result.isError, false);
  assert.equal(raw.body.result.structuredContent.requestId, "raw-http-report");
  assert.equal(raw.body.result.content[0].text, JSON.stringify(raw.body.result.structuredContent));
  assert.equal(await reportCount("raw-http-report"), 1);

  await closeProvider(first.child);
  const unavailable = await rawCreateReport(first.url, "must-not-be-created");
  assert.equal(unavailable.response.status, 200);
  assert.equal(unavailable.body.result.content[0].text, "Tool execution failed");
  assert.doesNotMatch(
    JSON.stringify({ ...unavailable.body.result, _meta: undefined }),
    /postgres|database|connection|provider/i,
  );
  assert.equal(await reportCount("must-not-be-created"), 0);

  const independent = await firstClient.callTool({ name: "describe-instance", arguments: {} });
  assert.deepEqual(independent.structuredContent, { instanceName: "instance-a" });
  const readiness = await fetch(new URL("/readyz", first.url));
  assert.equal(readiness.status, 503);
  assert.equal(await readiness.text(), "not ready\n");

  const secondStillWorks = await createReport(secondClient, "provider-b-still-works");
  assert.equal(secondStillWorks.requestId, "provider-b-still-works");
});

test("describes every multi-instance tool property", async (t) => {
  const instance = await startInstance("schema-instance", databaseUrl);
  const client = await connect(instance.url);
  t.after(async () => {
    await client.close();
    await stopInstance(instance.child);
  });

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), [
    "create-shared-harvest-report",
    "describe-instance",
  ]);
  const reportInput = listed.tools[0].inputSchema.properties;
  const reportOutput = listed.tools[0].outputSchema.properties;
  assert.equal(reportInput.requestId.description, "Idempotency key. Reusing it returns the existing report instead of creating another.");
  assert.equal(reportOutput.reportId.description, "Stored report identifier.");
  assert.equal(reportOutput.requestId.description, reportInput.requestId.description);
  assert.equal(reportOutput.createdByInstance.description, "Server instance that originally created the report.");
  assert.equal(reportOutput.totalPlants.description, "Total pea plants counted in the report.");
  assert.equal(reportOutput.peaTypeCounts.description, "Plant counts grouped by pea type.");
  assert.equal(reportOutput.peaTypeCounts.properties.shelling.description, "Shelling pea plants counted in the report.");
  assert.equal(reportOutput.peaTypeCounts.properties.snap.description, "Snap pea plants counted in the report.");
  assert.equal(listed.tools[1].outputSchema.properties.instanceName.description, "Server instance that handled this request.");
});

test("an unavailable PostgreSQL provider fails readiness but not independent tools", async (t) => {
  const instance = await startInstance(
    "unavailable-before-start",
    "postgres://emseepea:emseepea@127.0.0.1:1/emseepea",
  );
  const client = await connect(instance.url);
  t.after(async () => {
    await client.close();
    await stopInstance(instance.child);
  });

  assert.deepEqual(
    (await client.callTool({ name: "describe-instance", arguments: {} })).structuredContent,
    { instanceName: "unavailable-before-start" },
  );
  const unavailable = await rawCreateReport(instance.url, "provider-never-connected");
  assert.equal(unavailable.body.result.content[0].text, "Tool execution failed");
  assert.doesNotMatch(
    JSON.stringify({ ...unavailable.body.result, _meta: undefined }),
    /postgres|database|connection|ECONNREFUSED|provider/i,
  );
  const readiness = await fetch(new URL("/readyz", instance.url));
  assert.equal(readiness.status, 503);
  assert.equal(await readiness.text(), "not ready\n");
});

test("blocked PostgreSQL work finishes at the database timeout", async (t) => {
  const instance = await startInstance("blocked-query", databaseUrl);
  const blocker = await database.connect();
  t.after(async () => {
    await blocker.query("ROLLBACK").catch(() => {});
    blocker.release();
    await stopInstance(instance.child);
  });
  await blocker.query("BEGIN");
  await blocker.query("LOCK TABLE reports IN ACCESS EXCLUSIVE MODE");

  const started = Date.now();
  const [readiness, report] = await Promise.all([
    fetch(new URL("/readyz", instance.url)),
    rawCreateReport(instance.url, "blocked-report"),
  ]);

  assert.ok(Date.now() - started < 3_000, "blocked database work exceeded its bounded timeout");
  assert.equal(readiness.status, 503);
  assert.equal(report.body.result.content[0].text, "Tool execution failed");
  await blocker.query("ROLLBACK");
  assert.equal(await reportCount("blocked-report"), 0);
});

async function startInstance(instanceName, connectionString) {
  const child = fork(serverPath, [], {
    env: { ...process.env, DATABASE_URL: connectionString, EMSEEPEA_INSTANCE: instanceName, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let errors = "";
  child.stderr.on("data", (chunk) => { errors = `${errors}${chunk}`.slice(-2_000); });
  const message = await waitForMessage(child, ({ type }) => type === "ready")
    .catch((error) => { throw new Error(`${error.message}: ${errors}`); });
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
  const result = await client.callTool({ name: "create-shared-harvest-report", arguments: { requestId } });
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
      params: { name: "create-shared-harvest-report", arguments: { requestId }, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}

async function reportCount(requestId) {
  const result = await database.query(
    "SELECT COUNT(*)::integer AS count FROM reports WHERE idempotency_key = $1",
    [requestId],
  );
  return result.rows[0].count;
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
    new Promise((_, reject) => setTimeout(() => reject(new Error("server child did not stop")), 2_000)),
  ]);
}
