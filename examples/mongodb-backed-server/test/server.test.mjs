import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { MongoClient } from "mongodb";
import { createMongoExample } from "../dist/app.js";
import {
  databaseName,
  observationCollectionName,
  varietyCollectionName,
} from "../dist/database.js";
import {
  parsePeaObservationDocument,
  peaObservationDocumentSchema,
} from "../dist/pea-observation-document.js";
import { parsePeaDocument, peaDocumentSchema } from "../dist/pea-document.js";

const uri = process.env.MONGODB_URL;
assert.ok(uri, "MONGODB_URL is required");
const provider = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 2_000 });
await provider.connect();
const database = provider.db(databaseName);
const observations = database.collection(observationCollectionName);
const varieties = database.collection(varietyCollectionName);
after(() => provider.close());
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "mongodb-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("each collection has one application schema and only varieties enforce it in MongoDB", async () => {
  const [varietyCollection] = await database
    .listCollections({ name: varietyCollectionName }).toArray();
  const [observationCollection] = await database
    .listCollections({ name: observationCollectionName }).toArray();
  assert.deepEqual(varietyCollection.options.validator, { $jsonSchema: peaDocumentSchema });
  assert.equal(observationCollection.options.validator, undefined);
  assert.throws(() => parsePeaDocument({ name: "missing required fields" }));
  assert.throws(() => parsePeaObservationDocument({ variety_name: "missing required fields" }));
  await assert.rejects(varieties.insertOne({
    _id: "invalid-write",
    name: "Invalid Write",
    pea_type: "snap",
    growth_habit: "bush",
    days_to_maturity: "soon",
    notes: "MongoDB must reject this.",
  }));

  const invalidObservation = { _id: "invalid-direct-write", variety_name: "Schemaless" };
  await observations.insertOne(invalidObservation);
  assert.deepEqual(await observations.findOne({ _id: invalidObservation._id }), invalidObservation);
  await observations.deleteOne({ _id: invalidObservation._id });
  assert.deepEqual(Object.keys(peaObservationDocumentSchema.properties), [
    "_id", "variety_name", "observed_on", "location", "growth_stage", "notes",
  ]);
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["catalogue:write"];
  const { app } = await createMongoExample({
    uri,
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

test("setup fails closed when the schemaless collection already has a validator", async () => {
  await database.command({
    collMod: observationCollectionName,
    validator: { $jsonSchema: { bsonType: "object", required: ["unexpected"] } },
  });
  try {
    const rejected = spawnSync(process.execPath, ["dist/setup-database.js"], {
      encoding: "utf8",
      env: { ...process.env, MONGODB_URL: uri },
    });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /pea_observations must not have a MongoDB validator/);
  } finally {
    await observations.drop();
    const restored = spawnSync(process.execPath, ["dist/setup-database.js"], {
      encoding: "utf8",
      env: { ...process.env, MONGODB_URL: uri },
    });
    assert.equal(restored.status, 0, restored.stderr);
  }
});

test("reads, writes, and passes through a compatible new value", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { MONGODB_URL: uri },
  });
  const client = await running.connect();
  const snap = await client.callTool({ name: "list-pea-varieties", arguments: { pea_type: "snap" } });
  assert.deepEqual(snap.structuredContent, {
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
  assert.equal(Object.hasOwn(added.structuredContent, "_id"), false);

  const passedThrough = await client.callTool({
    name: "list-pea-varieties",
    arguments: { pea_type: "mangetout" },
  });
  assert.deepEqual(passedThrough.structuredContent, { varieties: [newVariety] });
});

test("records and reads observations while passing through a compatible new value", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { MONGODB_URL: uri },
  });
  const client = await running.connect();
  const newObservation = {
    variety_name: "Golden Sweet",
    observed_on: "2026-09-08",
    location: "West trellis",
    growth_stage: "tendrilling",
    notes: "New tendrils reached the support.",
  };
  const recorded = await client.callTool({
    name: "record-pea-observation",
    arguments: newObservation,
  });
  assert.equal(recorded.isError, false);
  assert.deepEqual(recorded.structuredContent, newObservation);
  assert.equal(Object.hasOwn(recorded.structuredContent, "_id"), false);

  const listed = await client.callTool({
    name: "list-pea-observations",
    arguments: { variety_name: "Golden Sweet" },
  });
  assert.deepEqual(listed.structuredContent, { observations: [newObservation] });
});

test("invalid stored documents never reach public output", async (t) => {
  await varieties.insertOne({
    _id: "invalid-read",
    name: "Invalid Read",
    pea_type: "test-invalid",
    growth_habit: "bush",
    days_to_maturity: "soon",
    notes: "Inserted only to prove read validation.",
  }, { bypassDocumentValidation: true });
  t.after(() => varieties.deleteOne({ _id: "invalid-read" }));
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { MONGODB_URL: uri },
  });
  assertGenericToolFailure(await rawCall(running.url, "list-pea-varieties", {
    pea_type: "test-invalid",
  }));

  await observations.insertOne({
    _id: "invalid-observation-read",
    variety_name: "Invalid Observation",
    observed_on: "not-a-date",
    location: "Test bed",
    growth_stage: "test-invalid",
    notes: "Inserted only to prove read validation.",
  });
  t.after(() => observations.deleteOne({ _id: "invalid-observation-read" }));
  assertGenericToolFailure(await rawCall(running.url, "list-pea-observations", {
    variety_name: "Invalid Observation",
  }));
});

test("public schemas are described, bounded, and hide database details", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { MONGODB_URL: uri },
  });
  const client = await running.connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name), [
    "add-pea-variety",
    "list-pea-observations",
    "list-pea-varieties",
    "record-pea-observation",
  ]);
  for (const tool of tools) {
    for (const schema of [tool.inputSchema, tool.outputSchema]) {
      for (const property of ["_id", "collection", "operator", "sort", "destination"]) {
        assert.equal(Object.hasOwn(schema.properties, property), false);
      }
    }
  }
  for (const tool of tools) {
    for (const schema of [tool.inputSchema, tool.outputSchema]) {
      for (const property of Object.values(schema.properties)) {
        assert.ok(property.description || property.type === "array");
      }
    }
  }

  await database.command({ profile: 0 });
  await database.collection("system.profile").drop().catch(() => {});
  await database.command({ profile: 2, slowms: 0 });
  t.after(() => database.command({ profile: 0 }));

  const countBefore = await varieties.countDocuments();
  const rejected = await rawCall(running.url, "add-pea-variety", {
    name: "Operator Attempt",
    pea_type: { $ne: "snap" },
    growth_habit: "bush",
    days_to_maturity: 60,
    notes: "Must not reach MongoDB.",
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.result.isError, true);
  assert.equal(await varieties.countDocuments(), countBefore);

  const observationCountBefore = await observations.countDocuments();
  const rejectedObservation = await rawCall(running.url, "record-pea-observation", {
    variety_name: "Operator Attempt",
    observed_on: "2026-09-08",
    location: "Test bed",
    growth_stage: { $ne: "flowering" },
    notes: "Must not reach MongoDB.",
  });
  assert.equal(rejectedObservation.response.status, 200);
  assert.equal(rejectedObservation.body.result.isError, true);
  assert.equal(await observations.countDocuments(), observationCountBefore);

  await database.command({ profile: 0 });
  const writes = await database.collection("system.profile").find({
    $or: ["insert", "update", "delete", "findAndModify"].flatMap((command) => [
      { [`command.${command}`]: varietyCollectionName },
      { [`command.${command}`]: observationCollectionName },
    ]),
  }).toArray();
  assert.deepEqual(writes, []);
});

test("both collection reads stay bounded and carry database timeouts", async (t) => {
  const prefix = `bounded-${process.pid}-`;
  const varietyDocuments = Array.from({ length: 25 }, (_, index) => ({
    _id: `${prefix}variety-${index}`,
    name: `${prefix}${String(index).padStart(2, "0")}`,
    pea_type: prefix,
    growth_habit: "bush",
    days_to_maturity: 60,
    notes: "Bounded result test.",
  }));
  const observationDocuments = Array.from({ length: 25 }, (_, index) => ({
    _id: `${prefix}observation-${index}`,
    variety_name: prefix,
    observed_on: `2026-09-${String((index % 9) + 1).padStart(2, "0")}`,
    location: "Test bed",
    growth_stage: `stage-${index}`,
    notes: "Bounded result test.",
  }));
  await varieties.insertMany(varietyDocuments);
  await observations.insertMany(observationDocuments);
  t.after(async () => {
    await varieties.deleteMany({ _id: { $in: varietyDocuments.map(({ _id }) => _id) } });
    await observations.deleteMany({ _id: { $in: observationDocuments.map(({ _id }) => _id) } });
  });

  await database.command({ profile: 0 });
  await database.collection("system.profile").drop().catch(() => {});
  await database.command({ profile: 2, slowms: 0 });
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { MONGODB_URL: uri },
  });
  const client = await running.connect();
  try {
    const varietyResult = await client.callTool({
      name: "list-pea-varieties",
      arguments: { pea_type: prefix },
    });
    const observationResult = await client.callTool({
      name: "list-pea-observations",
      arguments: { variety_name: prefix },
    });
    assert.equal(varietyResult.structuredContent.varieties.length, 20);
    assert.equal(observationResult.structuredContent.observations.length, 20);
  } finally {
    await database.command({ profile: 0 });
  }
  const profiled = await database.collection("system.profile").find({
    "command.find": { $in: [varietyCollectionName, observationCollectionName] },
  }).toArray();
  assert.deepEqual(
    new Map(profiled.map(({ command }) => [command.find, command.maxTimeMS])),
    new Map([[varietyCollectionName, 1_500], [observationCollectionName, 1_500]]),
  );
});

test("closing the app cleanly releases both collection paths", async () => {
  const { app, closeProvider } = await createMongoExample({ uri });
  await app.ready();
  await app.close();
  await closeProvider();
});

test("an unavailable database fails without connection details", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { MONGODB_URL: "mongodb://127.0.0.1:1" },
  });
  assertGenericToolFailure(await rawCall(running.url, "list-pea-varieties", {}));
  assertGenericToolFailure(await rawCall(running.url, "list-pea-observations", {}));
  const readiness = await fetch(new URL("/readyz", running.url));
  assert.equal(readiness.status, 503);
  assert.equal(await readiness.text(), "not ready\n");
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
    /mongodb|database|connection|ECONNREFUSED|provider/i,
  );
}
