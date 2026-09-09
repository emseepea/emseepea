import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { createSoapExample } from "../dist/app.js";
import { artifactsFromSources } from "../scripts/generate-types.mjs";
import { parseSoapEnvelopeSchema } from "../dist/soap-schema.js";
import { maximumSoapBytes, ValidatingHttpClient } from "../dist/validating-http-client.js";
import { startSoapFixture } from "../test-support/soap-fixture.mjs";

const invalidSoapResponses = [
  "Invalid XML",
  "Invalid XSD",
  "Zero Days",
  "Negative Days",
  "Fractional Days",
  "Empty Type",
  "Long Type",
  "Too Many Traits",
  "Missing Required Field",
  "Wrong Namespace",
  "DTD",
  "Entity",
  "Too Deep",
  "Too Many Nodes",
  "Too Many Attributes",
  "Text Too Long",
  "Oversized",
];
const resourceLimitFailures = new Map([
  ["Too Deep", /nesting depth \(32\) exceeded/],
  ["Too Many Nodes", /node count exceeds limit \(256\)/],
  ["Too Many Attributes", /Too many attributes.+limit: 32/],
  ["Text Too Long", /Text node exceeds maximum allowed length.+8192/],
  ["Oversized", /SOAP response too large/],
]);

test("retrieves XSD-validated SOAP data through a described MCP schema", async (t) => {
  const fixture = await startSoapFixture(t);
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { PEA_SOAP_URL: fixture.url.href },
  });
  const client = await running.connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name), ["get-pea-variety"]);
  const [tool] = tools;
  assert.equal(tool.inputSchema.properties.name.description, "Name of the pea variety to retrieve.");
  for (const property of ["name", "peaType", "daysToMaturity", "note", "traits"]) {
    assert.ok(tool.outputSchema.properties[property].description);
  }
  assert.equal(tool.outputSchema.properties.traits.maxItems, 5);

  const result = await client.callTool({ name: "get-pea-variety", arguments: { name: "Sugar Ann" } });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, {
    name: "Sugar Ann",
    peaType: "snap",
    daysToMaturity: 56,
    note: "Compact plants with edible pods.",
    traits: ["bush", "early"],
  });
  assert.equal(fixture.requests, 1);
  assert.equal(fixture.lastRequest.method, "POST");
  assert.equal(fixture.lastRequest.path, "/soap");
  assert.match(fixture.lastRequest.soapAction, /GetPea/);
  assert.match(fixture.lastRequest.body, /<(?:\w+:)?GetPeaRequest(?:\s|>)/);
  assert.match(fixture.lastRequest.body, /<(?:\w+:)?name>Sugar Ann<\/(?:\w+:)?name>/);

  const zeroTraits = await client.callTool({
    name: "get-pea-variety",
    arguments: { name: "Boundary Zero Traits" },
  });
  assert.deepEqual(zeroTraits.structuredContent, {
    name: "Boundary Zero Traits",
    peaType: "x",
    daysToMaturity: 1,
    traits: [],
  });

  const fiveTraits = await client.callTool({
    name: "get-pea-variety",
    arguments: { name: "Boundary Five Traits" },
  });
  assert.deepEqual(fiveTraits.structuredContent, {
    name: "Boundary Five Traits",
    peaType: "x".repeat(40),
    daysToMaturity: 1,
    traits: ["1", "2", "3", "4", "5"],
  });
});

test("the same template composes protected access and observability", async (t) => {
  const fixture = await startSoapFixture(t);
  const events = [];
  const permissions = ["varieties:read"];
  const { app } = await createSoapExample(fixture.url.href, {
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  });
  const running = await startEmseepea(t, app);
  const client = await running.connect("test-token");
  const result = await client.callTool({ name: "get-pea-variety", arguments: { name: "Sugar Ann" } });
  assert.equal(result.isError, false);
  assert.ok(events.some(({ capability }) => capability === "get-pea-variety"));
});

test("rejects unsafe and invalid SOAP responses with generic public failures", async (t) => {
  const fixture = await startSoapFixture(t);
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url), {
    environment: { PEA_SOAP_URL: fixture.url.href },
  });
  const client = await running.connect();
  for (const name of [
    "SOAP Fault",
    ...invalidSoapResponses,
    "Valid Error Status",
    "Redirect",
    "Timeout",
    "Trickle",
  ]) {
    const result = await client.callTool({ name: "get-pea-variety", arguments: { name } });
    assert.equal(result.isError, true, name);
    assert.equal(result.content[0].text, "Tool execution failed", name);
    assert.doesNotMatch(JSON.stringify(result), /Private fixture detail|DOCTYPE|ENTITY|example\.com|ECONN/i, name);
  }
});

test("invalid responses stop before the SOAP parser callback and mapper", async (t) => {
  const fixture = await startSoapFixture(t);
  const { schema } = await schemaSources();
  const client = new ValidatingHttpClient(fixture.url, schema);
  for (const name of invalidSoapResponses) {
    const delivered = await rawTransportCall(client, fixture.url.href, name);
    assert.ok(delivered.error instanceof Error, name);
    if (resourceLimitFailures.has(name)) {
      assert.match(delivered.error.message, resourceLimitFailures.get(name), name);
    }
    assert.equal(delivered.result, undefined, name);
    assert.equal(delivered.body, undefined, name);
  }
});

test("the transport blocks a different destination before sending", async (t) => {
  const fixture = await startSoapFixture(t);
  const { schema } = await schemaSources();
  const client = new ValidatingHttpClient(fixture.url, schema);
  const before = fixture.requests;
  const error = await new Promise((resolve) => {
    client.request("http://example.com/soap", "<request/>", (failure) => resolve(failure));
  });
  assert.ok(error instanceof Error);
  assert.equal(fixture.requests, before);
  await assert.rejects(createSoapExample("ftp://example.com/soap"));
});

test("the transport enforces an absolute deadline even while bytes arrive", { timeout: 3_000 }, async (t) => {
  const fixture = await startSoapFixture(t);
  const { schema } = await schemaSources();
  const started = performance.now();
  const delivered = await rawTransportCall(
    new ValidatingHttpClient(fixture.url, schema),
    fixture.url.href,
    "Trickle",
  );
  assert.ok(delivered.error instanceof Error);
  assert.match(delivered.error.message, /timed out/);
  assert.ok(performance.now() - started < 2_000);
  assert.equal(delivered.body, undefined);
});

test("schema loading is local-only and generated artefacts preserve their contract layers", async () => {
  const { envelope, service } = await schemaSources();
  await assert.rejects(parseSoapEnvelopeSchema(
    envelope.replace("pea-service.xsd", "https://example.com/remote.xsd"),
    service,
  ));
  const generated = await readFile(new URL("../src/generated/pea-service.ts", import.meta.url), "utf8");
  assert.match(generated, /name: string;/);
  assert.match(generated, /daysToMaturity: number;/);
  assert.match(generated, /note\?: string;/);
  assert.match(generated, /trait\?: string\[\];/);
  const mapperType = generated.match(/export interface PeaVariety \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(mapperType, /unknown/);
  const model = JSON.parse(await readFile(
    new URL("../src/generated/pea-service.schema-model.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(model.simpleTypes["{urn:emseepea:pea-service}PeaType"].facets, [
    { kind: "minLength", value: "1" },
    { kind: "maxLength", value: "40" },
  ]);
  const particles = model.complexTypes["{urn:emseepea:pea-service}PeaVariety"].particle.particles;
  assert.deepEqual(particles.find(({ element }) => element === "trait").occurrence, { min: 0, max: 5 });
});

test("the response cap is below the total network ceiling", () => {
  assert.equal(maximumSoapBytes, 64 * 1_024);
  assert.equal(maximumSoapBytes * 2, 128 * 1_024);
});

test("an oversized request is rejected before the fixture receives it", async (t) => {
  const fixture = await startSoapFixture(t);
  const { schema } = await schemaSources();
  const before = fixture.requests;
  const delivered = await new Promise((resolve) => {
    new ValidatingHttpClient(fixture.url, schema).request(
      fixture.url.href,
      "x".repeat(maximumSoapBytes + 1),
      (error, result, body) => resolve({ error, result, body }),
    );
  });
  assert.ok(delivered.error instanceof Error);
  assert.match(delivered.error.message, /SOAP request too large/);
  assert.equal(delivered.result, undefined);
  assert.equal(delivered.body, undefined);
  assert.equal(fixture.requests, before);
});

test("primitive and facet XSD changes affect the correct generated and runtime layers", async (t) => {
  const fixture = await startSoapFixture(t);
  const { envelope, service } = await schemaSources();
  const original = await artifactsFromSources(envelope, service);

  const primitiveService = service.replace('type="xs:positiveInteger"', 'type="xs:string"');
  const primitive = await artifactsFromSources(envelope, primitiveService);
  assert.match(original.types, /daysToMaturity: number;/);
  assert.match(primitive.types, /daysToMaturity: string;/);
  const primitiveTransport = new ValidatingHttpClient(
    fixture.url,
    await parseSoapEnvelopeSchema(envelope, primitiveService),
  );
  const primitiveResult = await rawTransportCall(primitiveTransport, fixture.url.href, "Invalid XSD");
  assert.equal(primitiveResult.error, null);
  assert.ok(primitiveResult.body);

  const facetService = service.replace('<xs:maxLength value="40"/>', '<xs:maxLength value="3"/>');
  const facet = await artifactsFromSources(envelope, facetService);
  assert.equal(facet.types, original.types);
  assert.notEqual(facet.model, original.model);
  const facetTransport = new ValidatingHttpClient(
    fixture.url,
    await parseSoapEnvelopeSchema(envelope, facetService),
  );
  const facetResult = await rawTransportCall(facetTransport, fixture.url.href, "Facet Mutation");
  assert.ok(facetResult.error instanceof Error);
  assert.equal(facetResult.body, undefined);
});

async function schemaSources() {
  const envelope = await readFile(new URL("../contracts/soap-envelope.xsd", import.meta.url), "utf8");
  const service = await readFile(new URL("../contracts/pea-service.xsd", import.meta.url), "utf8");
  return {
    envelope,
    service,
    schema: await parseSoapEnvelopeSchema(envelope, service),
  };
}

function rawTransportCall(client, url, name) {
  const request = `<GetPeaRequest><name>${name}</name></GetPeaRequest>`;
  return new Promise((resolve) => {
    client.request(url, request, (error, result, body) => resolve({ error, result, body }));
  });
}
