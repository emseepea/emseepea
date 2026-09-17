import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea, defineMcpAppResource, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const uri = "ui://pea/preview";
const definition = {
  access: "public", name: "pea-preview", uri, title: "Pea & <plan>",
  language: "en", bodyMarkup: '<main id="app"><h1>Plan</h1></main>',
  styles: "main{color:currentColor}", script: "window.plan = '</ScRiPt>';",
  csp: { connectDomains: ["https://example.com"], resourceDomains: [] },
  prefersBorder: true,
};

test("MCP App definitions reject invalid input at startup", () => {
  const invalid = [
    [{ uri: "https://example.com/app" }, /ui:\/\//],
    [{ script: undefined }, /script must be a string/],
    [{ script: undefined, bundleUrl: new URL("file:///tmp/app.js") }, /exactly one/],
    [{ language: "not a tag" }, /valid language tag/],
    [{ language: "" }, /non-empty language tag/],
    [{ csp: { connectDomains: ["https://example.com/path"] } }, /HTTPS origins/],
    [{ csp: { connectDomains: ["http://example.com"] } }, /HTTPS origins/],
    [{ csp: { connectDomains: ["https://example.com", "https://example.com"] } }, /repeated origins/],
    [{ csp: { connectDomains: Array(33).fill("https://example.com") } }, /at most 32/],
    [{ csp: { connectDomains: Array.from({ length: 22 }, (_, i) => `https://connect-${i}.example.com`), resourceDomains: Array.from({ length: 22 }, (_, i) => `https://resource-${i}.example.com`), frameDomains: Array.from({ length: 21 }, (_, i) => `https://frame-${i}.example.com`) } }, /at most 64/],
    [{ csp: { unknownDomains: [] } }, /unsupported field/],
    [{ prefersBorder: "yes" }, /must be a boolean/],
    [{ mimeType: "text/html" }, /mimeType must be/],
  ];
  for (const [change, error] of invalid) {
    assert.throws(() => defineMcpAppResource({ ...definition, ...change }), error);
  }
  const { script: _script, ...withoutScript } = definition;
  assert.throws(() => defineMcpAppResource(withoutScript), /exactly one/);
});

test("one packaged app aligns resource, tool, modern and legacy metadata", async () => {
  const directory = mkdtempSync(join(tmpdir(), "emseepea-mcp-app-"));
  const bundlePath = join(directory, "app.js");
  writeFileSync(bundlePath, "window.started = true;", "utf8");
  const { script: _script, ...bundleDefinition } = definition;
  const app = defineMcpAppResource({ ...bundleDefinition, bundleUrl: pathToFileURL(bundlePath) });
  const legacyUri = "ui://pea/legacy-preview";
  const legacyApp = defineMcpAppResource({
    ...bundleDefinition,
    name: "legacy-pea-preview",
    uri: legacyUri,
    mimeType: "text/html+skybridge",
    bundleUrl: pathToFileURL(bundlePath),
  });
  rmSync(directory, { recursive: true }); // Bundle is read once, not on each resource read.
  const server = createEmseepea({
    name: "mcp-app-resource-test", version: "0.0.0", resources: [app.resource, legacyApp.resource],
    tools: [defineTool({
      name: "open-pea-preview", access: "public", description: "Open the pea plan.",
      inputSchema: z.object({}), _meta: app.toolMetadata,
      handler: () => ({ text: "Pea plan available" }),
    })],
  });
  const running = await serveEmseepea(server, { port: 0 });
  try {
    for (const version of ["2026-07-28", "2025-11-25"]) {
      const client = new Client(
        { name: `mcp-app-${version}`, version: "0.0.0" },
        version === "2026-07-28"
          ? { versionNegotiation: { mode: { pin: version } } }
          : { supportedProtocolVersions: [version], versionNegotiation: { mode: "legacy" } },
      );
      await client.connect(new StreamableHTTPClientTransport(running.url));
      try {
        const resources = (await client.listResources()).resources;
        const listed = resources.find((resource) => resource.uri === uri);
        const legacyListed = resources.find((resource) => resource.uri === legacyUri);
        assert.ok(listed);
        assert.ok(legacyListed);
        const content = (await client.readResource({ uri })).contents[0];
        const legacyContent = (await client.readResource({ uri: legacyUri })).contents[0];
        const tool = (await client.listTools()).tools[0];
        assert.equal(listed.uri, uri);
        assert.equal(listed.mimeType, "text/html;profile=mcp-app");
        assert.equal(content.uri, uri);
        assert.equal(content.mimeType, listed.mimeType);
        assert.equal(legacyListed.mimeType, "text/html+skybridge");
        assert.equal(legacyContent.mimeType, legacyListed.mimeType);
        assert.match(content.text, /<html lang="en">/);
        assert.match(content.text, /<title>Pea &amp; &lt;plan&gt;<\/title>/);
        assert.match(content.text, /<main id="app"><h1>Plan<\/h1><\/main>/);
        assert.match(content.text, /<style>main\{color:currentColor\}<\/style>/);
        assert.match(content.text, /window\.started = true/);
        assert.deepEqual(listed._meta.ui, content._meta.ui);
        assert.deepEqual(listed._meta["openai/widgetCSP"], content._meta["openai/widgetCSP"]);
        assert.deepEqual(listed._meta["io.emseepea/access"], { type: "public" });
        assert.deepEqual(listed._meta.ui.csp, { connectDomains: ["https://example.com"], resourceDomains: [] });
        assert.equal(listed._meta.ui.prefersBorder, true);
        assert.deepEqual(listed._meta["openai/widgetCSP"].connect_domains, ["https://example.com"]);
        assert.equal(listed._meta["openai/widgetPrefersBorder"], true);
        assert.equal(tool._meta.ui.resourceUri, uri);
        assert.equal(tool._meta["openai/outputTemplate"], uri);
      } finally {
        await client.close();
      }
    }
  } finally {
    await running.close();
  }
  const inline = defineMcpAppResource(definition);
  const inlineServer = createEmseepea({ name: "inline-app", version: "0.0.0", resources: [inline.resource] });
  const inlineRunning = await serveEmseepea(inlineServer, { port: 0 });
  try {
    const client = new Client({ name: "inline-app", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(inlineRunning.url));
    try {
      const html = (await client.readResource({ uri })).contents[0].text;
      assert.match(html, /<script type="module">window\.plan = '<\\\/script>';<\/script>/);
    } finally { await client.close(); }
  } finally { await inlineRunning.close(); }

  const optional = defineMcpAppResource({ ...definition, uri: "ui://pea/optional", csp: {
    connectDomains: [], resourceDomains: [], frameDomains: ["https://frames.example.com"],
    baseUriDomains: ["https://base.example.com"],
  } });
  const optionalRunning = await serveEmseepea(createEmseepea({
    name: "optional-app", version: "0.0.0", resources: [optional.resource],
  }), { port: 0 });
  try {
    const client = new Client({ name: "optional-app", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(optionalRunning.url));
    try {
      assert.deepEqual((await client.listResources()).resources[0]._meta.ui.csp, {
        connectDomains: [], resourceDomains: [], frameDomains: ["https://frames.example.com"],
        baseUriDomains: ["https://base.example.com"],
      });
    } finally { await client.close(); }
  } finally { await optionalRunning.close(); }
});
