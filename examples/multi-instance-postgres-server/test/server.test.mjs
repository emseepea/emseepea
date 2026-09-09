import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Pool } from "pg";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { createMultiInstanceExample } from "../dist/app.js";

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

test("two interchangeable server processes share one coherent report store", async (t) => {
  const first = await startInstance("instance-a", databaseUrl);
  const second = await startInstance("instance-b", databaseUrl);
  assert.notEqual(first.child.pid, second.child.pid);
  assert.notEqual(first.url.href, second.url.href);
  const firstClient = await connect(first.url);
  const secondClient = await connect(second.url);
  t.after(async () => {
    await Promise.allSettled([firstClient.close(), secondClient.close()]);
    await Promise.all([stopInstance(first.child), stopInstance(second.child)]);
  });

  const original = {
    gardenBed: "North Bed",
    harvestDate: "2026-09-08",
    shellingCount: 12,
    snapCount: 8,
    totalPlants: 20,
  };
  assert.deepEqual(await saveReport(firstClient, original), original);
  assert.deepEqual(await getReport(secondClient, original), { report: original });

  assert.deepEqual(await saveReport(secondClient, original), original);
  assert.equal(await reportCount(original), 1);

  const updated = { ...original, shellingCount: 14, totalPlants: 22 };
  assert.deepEqual(await saveReport(secondClient, updated), updated);
  assert.deepEqual(await getReport(firstClient, updated), { report: updated });
  assert.equal(await reportCount(updated), 1);

  assert.deepEqual(await getReport(secondClient, {
    gardenBed: "Missing Bed",
    harvestDate: original.harvestDate,
  }), { report: null });

  const raw = await rawCall(first.url, "get-harvest-report", reportKey(updated));
  assert.equal(raw.response.status, 200);
  assert.equal(raw.body.result.isError, false);
  assert.deepEqual(raw.body.result.structuredContent, { report: updated });
  assert.equal(raw.body.result.content[0].text, JSON.stringify({ report: updated }));

  await closeProvider(first.child);
  const unavailable = await rawCall(first.url, "get-harvest-report", reportKey(updated));
  assertGenericToolFailure(unavailable);
  assert.deepEqual(await getReport(secondClient, updated), { report: updated });

  const readiness = await fetch(new URL("/readyz", first.url));
  assert.equal(readiness.status, 503);
  assert.equal(await readiness.text(), "not ready\n");
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["reports:write"];
  const { app } = await createMultiInstanceExample({
    databaseUrl,
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  });
  const running = await startEmseepea(t, app);
  const client = await running.connect("test-token");
  const result = await client.callTool({
    name: "get-harvest-report",
    arguments: { gardenBed: "Missing", harvestDate: "2026-09-08" },
  });
  assert.equal(result.isError, false);
  assert.ok(events.some(({ capability }) => capability === "get-harvest-report"));
});

test("describes every public harvest report property", async (t) => {
  const instance = await startInstance("schema-instance", databaseUrl);
  const client = await connect(instance.url);
  t.after(async () => {
    await client.close();
    await stopInstance(instance.child);
  });

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(({ name }) => name), [
    "get-harvest-report",
    "save-harvest-report",
  ]);

  const get = listed.tools[0];
  const save = listed.tools[1];
  assert.equal(get.inputSchema.properties.gardenBed.description, "Garden bed that this harvest report describes.");
  assert.equal(get.inputSchema.properties.harvestDate.description, "Harvest date in YYYY-MM-DD format.");
  assert.equal(
    get.outputSchema.properties.report.description,
    "The saved harvest report, or null when no report exists for that garden bed and date.",
  );
  const retrievedReport = get.outputSchema.properties.report.anyOf[0].properties;
  assert.equal(retrievedReport.gardenBed.description, "Garden bed that this harvest report describes.");
  assert.equal(retrievedReport.harvestDate.description, "Harvest date in YYYY-MM-DD format.");
  assert.equal(retrievedReport.shellingCount.description, "Shelling pea plants harvested.");
  assert.equal(retrievedReport.snapCount.description, "Snap pea plants harvested.");
  assert.equal(retrievedReport.totalPlants.description, "Total pea plants harvested.");
  assert.equal(save.inputSchema.properties.gardenBed.description, "Garden bed that this harvest report describes.");
  assert.equal(save.inputSchema.properties.harvestDate.description, "Harvest date in YYYY-MM-DD format.");
  assert.equal(save.inputSchema.properties.shellingCount.description, "Shelling pea plants harvested.");
  assert.equal(save.inputSchema.properties.snapCount.description, "Snap pea plants harvested.");
  assert.equal(save.outputSchema.properties.gardenBed.description, "Garden bed that this harvest report describes.");
  assert.equal(save.outputSchema.properties.harvestDate.description, "Harvest date in YYYY-MM-DD format.");
  assert.equal(save.outputSchema.properties.shellingCount.description, "Shelling pea plants harvested.");
  assert.equal(save.outputSchema.properties.snapCount.description, "Snap pea plants harvested.");
  assert.equal(save.outputSchema.properties.totalPlants.description, "Total pea plants harvested.");
});

test("an unavailable PostgreSQL provider fails safely", async (t) => {
  const instance = await startInstance(
    "unavailable-before-start",
    "postgres://emseepea:emseepea@127.0.0.1:1/emseepea",
  );
  t.after(() => stopInstance(instance.child));

  assertGenericToolFailure(await rawCall(instance.url, "get-harvest-report", {
    gardenBed: "Unavailable Bed",
    harvestDate: "2026-09-08",
  }));
  assertGenericToolFailure(await rawCall(instance.url, "save-harvest-report", {
    gardenBed: "Unavailable Bed",
    harvestDate: "2026-09-08",
    shellingCount: 1,
    snapCount: 1,
  }));
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
  await blocker.query("LOCK TABLE harvest_reports IN ACCESS EXCLUSIVE MODE");

  const blockedReport = {
    gardenBed: "Blocked Bed",
    harvestDate: "2026-09-08",
    shellingCount: 2,
    snapCount: 3,
  };
  const started = Date.now();
  const [readiness, save, get] = await Promise.all([
    fetch(new URL("/readyz", instance.url)),
    rawCall(instance.url, "save-harvest-report", blockedReport),
    rawCall(instance.url, "get-harvest-report", reportKey(blockedReport)),
  ]);

  assert.ok(Date.now() - started < 3_000, "blocked database work exceeded its bounded timeout");
  assert.equal(readiness.status, 503);
  assertGenericToolFailure(save);
  assertGenericToolFailure(get);
  await blocker.query("ROLLBACK");
  assert.equal(await reportCount(blockedReport), 0);
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

async function saveReport(client, report) {
  const result = await client.callTool({
    name: "save-harvest-report",
    arguments: { ...reportKey(report), shellingCount: report.shellingCount, snapCount: report.snapCount },
  });
  assert.equal(result.isError, false);
  return result.structuredContent;
}

async function getReport(client, report) {
  const result = await client.callTool({ name: "get-harvest-report", arguments: reportKey(report) });
  assert.equal(result.isError, false);
  return result.structuredContent;
}

function reportKey({ gardenBed, harvestDate }) {
  return { gardenBed, harvestDate };
}

async function rawCall(url, name, arguments_) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: arguments_, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}

function assertGenericToolFailure(result) {
  assert.equal(result.response.status, 200);
  assert.equal(result.body.result.content[0].text, "Tool execution failed");
  assert.doesNotMatch(
    JSON.stringify({ ...result.body.result, _meta: undefined }),
    /postgres|database|connection|ECONNREFUSED|provider/i,
  );
}

async function reportCount({ gardenBed, harvestDate }) {
  const result = await database.query(
    "SELECT COUNT(*)::integer AS count FROM harvest_reports WHERE garden_bed = $1 AND harvest_date = $2",
    [gardenBed, harvestDate],
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
