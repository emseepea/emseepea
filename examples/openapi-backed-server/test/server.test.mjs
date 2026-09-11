import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, defineMappedTool, serveEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { z } from "zod";
import { createBackendExample } from "../dist/app.js";
import { assertLocalReferences, generatedArtifacts } from "../scripts/generate.mjs";
import { get_GetPetById, Pet } from "../dist/generated/petstore.js";
import { petstoreFixture } from "../test-support/petstore-fixture.mjs";

test("the OpenAPI-backed example uses generated request and response validation", async () => {
  const requests = [];
  let response = petstoreFixture;
  const app = await createBackendExample({
    async get(options) {
      requests.push(options);
      if (response instanceof Error) throw response;
      return response;
    },
  });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client(
    { name: "openapi-backed-example-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));

  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(({ name }) => name), ["get-pet"]);

    const invalidInput = await client.callTool({ name: "get-pet", arguments: { petId: 0 } });
    assert.equal(invalidInput.isError, true);
    assert.equal(requests.length, 0);

    const result = await client.callTool({ name: "get-pet", arguments: { petId: 7 } });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      id: 7,
      name: "Sweet Pea",
      status: "available",
      photoUrls: ["https://example.test/sweet-pea.jpg"],
      source: "Swagger Petstore",
    });
    assert.equal(requests[0].pathname, "/api/v3/pet/7");
    assert.equal(requests[0].signal instanceof AbortSignal, true);
    assert.ok(requests[0].deadlineMs > Date.now());

    response = { ...petstoreFixture, name: 42 };
    const invalidProviderData = await client.callTool({ name: "get-pet", arguments: { petId: 7 } });
    assert.equal(invalidProviderData.isError, true);
    assert.doesNotMatch(JSON.stringify(invalidProviderData), /42|photoUrls/);

    response = { ...petstoreFixture, private_note: "do not expose" };
    const extraProviderData = await client.callTool({ name: "get-pet", arguments: { petId: 7 } });
    assert.equal(extraProviderData.isError, false);
    assert.equal("private_note" in extraProviderData.structuredContent, false);
  } finally {
    await client.close();
    await running.close();
  }
});

test("contract loading permits only fragment references", () => {
  assert.doesNotThrow(() => assertLocalReferences({ $ref: "#/components/schemas/Pet" }));
  assert.throws(() => assertLocalReferences({ $ref: "https://example.test/pet.yaml" }), /non-local/);
  assert.throws(() => assertLocalReferences({ $ref: "pet.yaml#/Pet" }), /non-local/);
});

test("the generation entry point rejects non-local references", async () => {
  await assert.rejects(
    generatedArtifacts({ $ref: "https://example.test/pet.yaml" }),
    /non-local/,
  );
  await assert.rejects(generatedArtifacts({ $ref: "pet.yaml#/Pet" }), /non-local/);
});

test("contract changes alter the generated declarations and validators", async () => {
  const source = generationContract();
  const baseline = await generatedArtifacts(source);
  for (const mutate of [
    (document) => { document.components.schemas.Pet.required = ["photoUrls"]; },
    (document) => { delete document.components.schemas.Pet.properties.note; },
    (document) => { document.components.schemas.Pet.properties.name.type = "integer"; },
    (document) => { document.components.schemas.Pet.properties.status.enum.push("archived"); },
  ]) {
    const changed = structuredClone(source);
    mutate(changed);
    const regenerated = await generatedArtifacts(changed);
    assert.notEqual(regenerated.schemas, baseline.schemas);
    assert.notEqual(regenerated.types, baseline.types);
  }
  assert.equal(Pet.safeParse(petstoreFixture).success, true);
  assert.equal(Pet.safeParse({ ...petstoreFixture, status: "archived" }).success, false);
});

test("an invalid mapped backend request makes no adapter call", async () => {
  let adapterCalls = 0;
  const tool = defineMappedTool({
    name: "invalid-generated-request",
    access: "public",
    description: "Exercise the generated request boundary.",
    inputSchema: z.object({ petId: z.number().int().positive() }),
    outputSchema: z.object({ ok: z.boolean() }),
    backendInputSchema: get_GetPetById.parameters.path,
    backendOutputSchema: z.object({ ok: z.boolean() }),
    mapInput: () => ({ petId: "not-an-integer" }),
    adapter() {
      adapterCalls += 1;
      return { ok: true };
    },
    mapOutput: (data) => ({ data }),
  });
  const running = await serveEmseepea(createEmseepea({
    name: "invalid-generated-request-test",
    version: "0.0.0",
    tools: [tool],
  }), { port: 0 });
  const client = new Client(
    { name: "invalid-generated-request-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));
  try {
    const result = await client.callTool({ name: "invalid-generated-request", arguments: { petId: 7 } });
    assert.equal(result.isError, true);
    assert.equal(adapterCalls, 0);
  } finally {
    await client.close();
    await running.close();
  }
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["pets:read"];
  const app = await createBackendExample(
    { get: async () => petstoreFixture },
    {
      access: { access: "protected", requiredScopes: permissions },
      authentication: insecureTestAuthentication(permissions),
      observability: [{ id: "test-log", emit: (event) => events.push(event) }],
    },
  );
  const running = await startEmseepea(t, app);
  const client = await running.connect("test-token");
  const result = await client.callTool({ name: "get-pet", arguments: { petId: 7 } });
  assert.equal(result.isError, false);
  assert.ok(events.some(({ capability }) => capability === "get-pet"));
});

function generationContract() {
  return {
    openapi: "3.0.4",
    info: { title: "Generation fixture", version: "1.0.0" },
    paths: {
      "/pet/{petId}": {
        get: {
          operationId: "getPetById",
          parameters: [{
            name: "petId",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          }],
          responses: {
            200: {
              description: "Pet",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Pet: {
          type: "object",
          required: ["name", "photoUrls"],
          properties: {
            name: { type: "string" },
            note: { type: "string" },
            photoUrls: { type: "array", items: { type: "string" } },
            status: { type: "string", enum: ["available", "pending", "sold"] },
          },
        },
      },
    },
  };
}
