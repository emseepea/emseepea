import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { serveEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { createBackendExample } from "../dist/app.js";
import { inaturalistFixture } from "../test-support/inaturalist-fixture.mjs";

test("the API-backed example checks and passes through selected iNaturalist values", async () => {
  const requests = [];
  let response = inaturalistFixture;
  const app = await createBackendExample({
    async get(options) {
      requests.push(options);
      if (response instanceof Error) throw response;
      return response;
    },
  });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client(
    { name: "api-backed-example-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));

  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(({ name }) => name), ["search-pea-taxa"]);
    const tool = listed.tools[0];
    assert.equal(tool.inputSchema.properties.query.description, "Pea name or other taxon search terms.");
    assert.equal(tool.outputSchema.properties.total_results.description, "Total matching taxa reported by iNaturalist.");
    assert.equal(tool.outputSchema.properties.results.description, "Up to five matching taxa.");
    const taxon = tool.outputSchema.properties.results.items.properties;
    assert.equal(taxon.id.description, "iNaturalist identifier for the taxon.");
    assert.equal(taxon.name.description, "Scientific name of the taxon.");
    assert.equal(taxon.preferred_common_name.description, "Preferred common name when iNaturalist provides one.");
    assert.equal(taxon.rank.description, "Taxonomic rank reported by iNaturalist.");
    assert.equal(taxon.observations_count.description, "Recorded iNaturalist observations, not an estimate of the wild population.");
    assert.equal(tool.outputSchema.properties.query.description, "Trimmed search terms sent to iNaturalist.");
    assert.equal(tool.outputSchema.properties.source.description, "Data provider for these results.");
    assert.equal(tool.outputSchema.properties.source_url.description, "Website of the data provider.");

    const invalidInput = await client.callTool({
      name: "search-pea-taxa",
      arguments: { query: "x" },
    });
    assert.equal(invalidInput.isError, true);
    assert.equal(requests.length, 0);

    const result = await client.callTool({
      name: "search-pea-taxa",
      arguments: { query: " pea " },
    });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      query: "pea",
      ...inaturalistFixture,
      source: "iNaturalist",
      source_url: "https://www.inaturalist.org",
    });
    assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
    assert.equal(requests[0].pathname, "/v1/taxa");
    assert.deepEqual(requests[0].searchParams, {
      q: "pea",
      rank: "species",
      per_page: "5",
    });
    assert.equal(requests[0].signal instanceof AbortSignal, true);
    assert.ok(requests[0].deadlineMs > Date.now());

    response = {
      total_results: 1,
      results: [{
        id: 123,
        name: "Pisum example",
        preferred_common_name: null,
        rank: "new-provider-rank",
        observations_count: 0,
        private_note: "do not expose",
      }],
    };
    const newProviderValue = await client.callTool({
      name: "search-pea-taxa",
      arguments: { query: "Pisum" },
    });
    assert.equal(newProviderValue.isError, false);
    assert.deepEqual(newProviderValue.structuredContent.results[0], {
      id: 123,
      name: "Pisum example",
      preferred_common_name: null,
      rank: "new-provider-rank",
      observations_count: 0,
    });
    assert.equal("private_note" in newProviderValue.structuredContent.results[0], false);
    assert.equal(newProviderValue.content[0].text, JSON.stringify(newProviderValue.structuredContent));

    response = { total_results: 1, results: [{ id: "bad provider row" }] };
    const invalidProviderData = await client.callTool({
      name: "search-pea-taxa",
      arguments: { query: "pea" },
    });
    assert.equal(invalidProviderData.isError, true);
    assert.doesNotMatch(JSON.stringify(invalidProviderData), /bad provider row|preferred_common_name/);

    response = new Error("private-provider-error");
    const providerFailure = await client.callTool({
      name: "search-pea-taxa",
      arguments: { query: "pea" },
    });
    assert.equal(providerFailure.isError, true);
    assert.doesNotMatch(JSON.stringify(providerFailure), /private-provider-error|inaturalist\.org/i);
  } finally {
    await client.close();
    await running.close();
  }
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["taxa:search"];
  const app = await createBackendExample(
    { get: async () => inaturalistFixture },
    {
      access: { access: "protected", requiredScopes: permissions },
      authentication: insecureTestAuthentication(permissions),
      observability: [{ id: "test-log", emit: (event) => events.push(event) }],
    },
  );
  const running = await startEmseepea(t, app);
  const client = await running.connect("test-token");
  const result = await client.callTool({ name: "search-pea-taxa", arguments: { query: "pea" } });
  assert.equal(result.isError, false);
  assert.ok(events.some(({ capability }) => capability === "search-pea-taxa"));
});
