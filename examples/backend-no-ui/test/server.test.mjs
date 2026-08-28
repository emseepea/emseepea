import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { serveEmseepea } from "@emseepea/server";
import { createBackendExample } from "../dist/app.js";
import { brewmarkFixture } from "../test-support/brewmark-fixture.mjs";

test("the backend example maps, checks, and explains BrewMark data", async () => {
  const requests = [];
  let response = brewmarkFixture;
  const app = createBackendExample({
    async get(options) {
      requests.push(options);
      if (response instanceof Error) throw response;
      if (response === brewmarkFixture && options.searchParams.roastLevel === "LIGHT") {
        return { ...response, data: response.data.filter(({ roastLevel }) => roastLevel === "LIGHT") };
      }
      return response;
    },
  });
  const running = await serveEmseepea(app, { port: 0 });
  const client = new Client(
    { name: "backend-example-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(running.url)));

  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(({ name }) => name), ["search-coffee-catalog"]);

    const invalidInput = await client.callTool({
      name: "search-coffee-catalog",
      arguments: { query: "x" },
    });
    assert.equal(invalidInput.isError, true);
    assert.equal(requests.length, 0);

    const result = await client.callTool({
      name: "search-coffee-catalog",
      arguments: { query: " natural ", roast: "light" },
    });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      query: "natural",
      roastFilter: "light",
      returnedCount: 1,
      moreMatchesAvailable: true,
      ratingScale: {
        acidity: "1 = low acidity; 5 = high acidity",
        body: "1 = light body; 5 = full body",
      },
      coffees: [
        {
          name: "Riverlight Natural",
          roaster: "North Star Sample Roasters",
          origin: "Burundi",
          roast: "light",
          processingMethod: "Natural",
          flavourNotes: "Blackberry, hibiscus",
          acidityLevel: 5,
          bodyLevel: 2,
        },
      ],
      source: "BrewMark",
      sourceUrl: "https://brewmark.io",
    });
    assert.match(result.content[0].text, /Acidity: 1 = low acidity; 5 = high acidity\./);
    assert.match(result.content[0].text, /Body: 1 = light body; 5 = full body\./);
    assert.equal(requests[0].pathname, "/api/coffees");
    assert.deepEqual(requests[0].searchParams, {
      q: "natural",
      roastLevel: "LIGHT",
      sort: "alpha",
      limit: "5",
    });
    assert.equal(requests[0].signal instanceof AbortSignal, true);
    assert.ok(requests[0].deadlineMs > Date.now());

    response = {
      data: [{
        name: "Details Pending",
        roasterName: "Sample Coffee",
        roastLevel: "LIGHT",
        origin: null,
        processingMethod: null,
        flavorProfile: null,
        acidityLevel: null,
        bodyLevel: null,
      }],
      cursor: null,
      hasMore: false,
    };
    const missingDetails = await client.callTool({
      name: "search-coffee-catalog",
      arguments: { query: "pending" },
    });
    assert.equal(missingDetails.isError, false);
    assert.deepEqual(missingDetails.structuredContent.coffees[0], {
      name: "Details Pending",
      roaster: "Sample Coffee",
      origin: null,
      roast: "light",
      processingMethod: null,
      flavourNotes: null,
      acidityLevel: null,
      bodyLevel: null,
    });
    assert.match(missingDetails.content[0].text, /origin: not provided/);
    assert.match(missingDetails.content[0].text, /acidity: not provided/);
    assert.match(missingDetails.content[0].text, /body: not provided/);

    response = { data: [{ name: "bad provider row" }], cursor: null, hasMore: false };
    const invalidProviderData = await client.callTool({
      name: "search-coffee-catalog",
      arguments: { query: "natural" },
    });
    assert.equal(invalidProviderData.isError, true);
    assert.doesNotMatch(JSON.stringify(invalidProviderData), /bad provider row|roasterName/);

    response = new Error("private-provider-error");
    const providerFailure = await client.callTool({
      name: "search-coffee-catalog",
      arguments: { query: "natural" },
    });
    assert.equal(providerFailure.isError, true);
    assert.doesNotMatch(JSON.stringify(providerFailure), /private-provider-error|brewmark\.io/i);
  } finally {
    await client.close();
    await running.close();
  }
});
