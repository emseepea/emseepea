import assert from "node:assert/strict";
import test, { after } from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { Pool } from "pg";
import { createDatabaseSchemaExample } from "../dist/app.js";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");
const database = new Pool({ connectionString: databaseUrl, max: 2 });
after(() => database.end());
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "database-schema-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("reads and writes through the view and summarizes through the procedure", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { DATABASE_URL: databaseUrl },
  });
  const client = await running.connect();

  const listed = await client.callTool({
    name: "list-pea-varieties",
    arguments: { pea_type: "snap" },
  });
  assert.equal(listed.isError, false);
  assert.deepEqual(listed.structuredContent, {
    varieties: [{
      name: "Sugar Ann",
      pea_type: "snap",
      growth_habit: "bush",
      days_to_maturity: 56,
      notes: "Compact plants with edible pods.",
    }],
  });

  const newVariety = {
    name: "Golden Sweet",
    pea_type: "mangetout",
    growth_habit: "climbing",
    days_to_maturity: 70,
    notes: "Purple flowers and flat edible pods.",
  };
  const added = await client.callTool({ name: "add-pea-variety", arguments: newVariety });
  assert.equal(added.isError, false);
  assert.deepEqual(added.structuredContent, newVariety);

  const passedThrough = await client.callTool({
    name: "list-pea-varieties",
    arguments: { pea_type: "mangetout" },
  });
  assert.deepEqual(passedThrough.structuredContent, { varieties: [newVariety] });

  const summary = await client.callTool({
    name: "summarize-pea-catalog",
    arguments: { pea_type: "snap" },
  });
  assert.equal(summary.isError, false);
  assert.deepEqual(summary.structuredContent, {
    pea_type: "snap",
    variety_count: 1,
    fastest_days_to_maturity: 56,
  });

  const injected = await client.callTool({
    name: "list-pea-varieties",
    arguments: { pea_type: "snap' OR true --" },
  });
  assert.deepEqual(injected.structuredContent, { varieties: [] });
  assert.doesNotMatch(
    `${running.output().stdout}\n${running.output().stderr}`,
    new RegExp(escapeRegExp(databaseUrl)),
  );
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["catalogue:write"];
  const { app } = await createDatabaseSchemaExample({
    databaseUrl,
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  });
  const running = await startEmseepea(t, app);
  const client = await running.connect("test-token");
  const result = await client.callTool({ name: "list-pea-varieties", arguments: {} });
  assert.equal(result.isError, false);
  assert.ok(events.some(({ capability }) => capability === "list-pea-varieties"));
});

test("the catalogue read has a fixed 20-row boundary", async (t) => {
  await database.query(`
    INSERT INTO pea_variety_catalog
      (name, pea_type, growth_habit, days_to_maturity, notes)
    SELECT 'Boundary ' || LPAD(number::text, 2, '0'), 'bounded', 'bush', 60, ''
    FROM generate_series(1, 25) AS number
  `);
  t.after(() => database.query("DELETE FROM pea_variety_catalog WHERE pea_type = 'bounded'"));

  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { DATABASE_URL: databaseUrl },
  });
  const client = await running.connect();
  const result = await client.callTool({
    name: "list-pea-varieties",
    arguments: { pea_type: "bounded" },
  });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.varieties.length, 20);
});

test("advertises bounded and described public schemas", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { DATABASE_URL: databaseUrl },
  });
  const client = await running.connect();
  const { tools } = await client.listTools();

  assert.deepEqual(tools.map(({ name }) => name), [
    "add-pea-variety",
    "list-pea-varieties",
    "summarize-pea-catalog",
  ]);
  const add = tools[0];
  const list = tools[1];
  const summary = tools[2];
  for (const property of ["name", "pea_type", "growth_habit", "days_to_maturity", "notes"]) {
    assert.ok(add.inputSchema.properties[property].description, `${property} input needs a description`);
    assert.ok(add.outputSchema.properties[property].description, `${property} output needs a description`);
  }
  assert.deepEqual(Object.keys(list.inputSchema.properties), ["pea_type"]);
  assert.ok(list.inputSchema.properties.pea_type.description);
  assert.ok(list.outputSchema.properties.varieties.description);
  assert.ok(summary.inputSchema.properties.pea_type.description);
  assert.ok(summary.outputSchema.properties.variety_count.description);
  assert.ok(summary.outputSchema.properties.fastest_days_to_maturity.description);
});

test("generated validation blocks an invalid database row at the tool boundary", async (t) => {
  const schema = `invalid_output_${process.pid}`;
  await database.query(`CREATE SCHEMA ${schema}`);
  try {
    await database.query(`
      CREATE VIEW ${schema}.pea_variety_catalog AS
      SELECT name, pea_type, growth_habit, days_to_maturity::text, notes
      FROM public.pea_variety_catalog
    `);
    const invalidUrl = new URL(databaseUrl);
    invalidUrl.searchParams.set("options", `-c search_path=${schema}`);
    const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
      environment: { DATABASE_URL: invalidUrl.href },
    });
    assertGenericToolFailure(await rawCall(running.url, "list-pea-varieties", {}));
  } finally {
    await database.query(`DROP SCHEMA ${schema} CASCADE`);
  }
});

test("an unavailable database fails without exposing provider details", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { DATABASE_URL: "postgres://emseepea:emseepea@127.0.0.1:1/emseepea" },
  });
  const result = await rawCall(running.url, "list-pea-varieties", {});
  assertGenericToolFailure(result);
  const readiness = await fetch(new URL("/readyz", running.url));
  assert.equal(readiness.status, 503);
  assert.equal(await readiness.text(), "not ready\n");
  assert.doesNotMatch(
    `${running.output().stdout}\n${running.output().stderr}`,
    /postgres:\/\/emseepea:emseepea@127\.0\.0\.1:1\/emseepea/,
  );
});

test("blocked database work stops at the statement timeout", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { DATABASE_URL: databaseUrl },
  });
  const blocker = await database.connect();
  t.after(async () => {
    await blocker.query("ROLLBACK").catch(() => {});
    blocker.release();
  });
  await blocker.query("BEGIN");
  await blocker.query("LOCK TABLE pea_varieties IN ACCESS EXCLUSIVE MODE");

  const started = Date.now();
  const result = await rawCall(running.url, "list-pea-varieties", {});
  assert.ok(Date.now() - started < 3_000, "blocked query exceeded its bounded timeout");
  assertGenericToolFailure(result);
});

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
