import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createEmseepea, defineResource, defineTool } from "@emseepea/server";
import { z } from "zod";
import {
  assertPublishedMcpContractCompatible,
  comparePublishedMcpContracts,
  extractPublishedMcpContract,
  startEmseepea,
  writePublishedMcpContractBaseline,
} from "../dist/index.js";

test("extracts the effective contract through the real MCP boundary", async (t) => {
  const resourceUri = "ui://contract-test";
  const running = await startEmseepea(t, createEmseepea({
    name: "published-contract-test",
    version: "0.0.0",
    tools: [defineTool({
      name: "inspect-contract",
      access: "public",
      description: "Inspect the synthetic contract.",
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ accepted: z.boolean() }),
      _meta: { ui: { resourceUri }, "openai/outputTemplate": resourceUri },
      handler: () => ({ data: { accepted: true } }),
    })],
    resources: [defineResource({
      name: "contract-app",
      access: "public",
      uri: resourceUri,
      mimeType: "text/html;profile=mcp-app",
      _meta: { ui: { resourceUri } },
      handler: () => ({ contents: [{
        uri: resourceUri,
        mimeType: "text/html;profile=mcp-app",
        text: "<main>Contract fixture</main>",
        _meta: { ui: { resourceUri, csp: { connectDomains: [] } } },
      }] }),
    })],
  }));
  const contract = await extractPublishedMcpContract(await running.connect());
  assert.equal(contract.tools[0].name, "inspect-contract");
  assert.deepEqual(contract.tools[0]._meta.ui, { resourceUri });
  assert.equal(contract.resources[0].contents[0].mimeType, "text/html;profile=mcp-app");
  assert.deepEqual(contract.resources[0].contents[0]._meta.ui.csp, { connectDomains: [] });
});

test("extracts and writes one deterministic public contract through every page", async (t) => {
  const calls = [];
  const client = {
    async listTools(params) {
      calls.push(["tools", params?.cursor]);
      return params?.cursor === "tools-2"
        ? { tools: [{ name: "alpha", inputSchema: { type: "object" } }] }
        : { tools: [{ name: "zulu", inputSchema: { type: "object" } }], nextCursor: "tools-2" };
    },
    async listResources(params) {
      calls.push(["resources", params?.cursor]);
      return params?.cursor === "resources-2"
        ? { resources: [{ name: "app", uri: "ui://app", mimeType: "text/html" }] }
        : { resources: [{ name: "guide", uri: "guide://start", mimeType: "text/markdown" }], nextCursor: "resources-2" };
    },
    async readResource({ uri }) {
      calls.push(["read", uri]);
      return { contents: [{
        uri,
        mimeType: uri.startsWith("ui:") ? "text/html" : "text/markdown",
        text: "body intentionally excluded",
        _meta: uri.startsWith("ui:") ? { ui: { csp: { connectDomains: [] } } } : undefined,
      }] };
    },
  };
  const contract = await extractPublishedMcpContract(client);
  assert.deepEqual(contract.tools.map(({ name }) => name), ["alpha", "zulu"]);
  assert.deepEqual(contract.resources.map(({ uri }) => uri), ["guide://start", "ui://app"]);
  assert.equal("text" in contract.resources[0].contents[0], false);
  assert.deepEqual(calls, [
    ["tools", undefined], ["tools", "tools-2"],
    ["resources", undefined], ["resources", "resources-2"],
    ["read", "guide://start"], ["read", "ui://app"],
  ]);

  const directory = await mkdtemp(join(tmpdir(), "emseepea-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = join(directory, "1.0.0.json");
  const second = join(directory, "copy.json");
  const baseline = { version: "1.0.0", contract };
  await writePublishedMcpContractBaseline(first, baseline);
  await writePublishedMcpContractBaseline(second, baseline);
  assert.equal(await readFile(first, "utf8"), await readFile(second, "utf8"));
});

test("accepts direction-compatible input and output schema changes", () => {
  const baseline = contract({
    inputSchema: objectSchema({
      choice: { type: "string", enum: ["a"] },
      count: { type: "number", minimum: 1, maximum: 5 },
    }, ["choice"]),
    outputSchema: objectSchema({
      status: { type: "string", enum: ["ready", "waiting"] },
      count: { type: "number", minimum: 0, maximum: 10 },
    }, ["status", "count"]),
  });
  const current = contract({
    inputSchema: objectSchema({
      choice: { type: "string", enum: ["a", "b"] },
      count: { type: "number", minimum: 0, maximum: 10 },
      note: { type: "string" },
    }, ["choice"]),
    outputSchema: objectSchema({
      status: { type: "string", enum: ["ready"] },
      count: { type: "number", minimum: 1, maximum: 9 },
    }, ["status", "count"]),
  });
  assert.deepEqual(comparePublishedMcpContracts(current, [{ version: "1.0.0", contract: baseline }]), []);
  assert.doesNotThrow(() => assertPublishedMcpContractCompatible(current, [{ version: "1.0.0", contract: baseline }]));
  assert.throws(() => comparePublishedMcpContracts(current, []), /at least one published MCP contract baseline/i);
});

test("treats adding an input type and removing an output type as breaking", () => {
  const baseline = contract({
    inputSchema: objectSchema({ value: {} }, []),
    outputSchema: objectSchema({ value: { type: "string" } }, ["value"]),
  });
  const current = contract({
    inputSchema: objectSchema({ value: { type: "string" } }, []),
    outputSchema: objectSchema({ value: {} }, ["value"]),
  });
  const breaks = comparePublishedMcpContracts(current, [{ version: "1", contract: baseline }]);
  assert.equal(breaks.filter(({ kind }) => kind.endsWith("type-changed")).length, 2);
});

test("reports concrete input, output, resource, UI, CSP, and unknown-schema breaks", () => {
  const baseline = contract({
    inputSchema: objectSchema({
      choice: { type: "string", enum: ["a", "b"], maxLength: 20 },
      count: { type: "number", minimum: 0 },
      conditional: { type: "string", anyOf: [{ const: "a" }, { const: "b" }] },
    }, ["choice"]),
    outputSchema: objectSchema({
      status: { type: "string", enum: ["ready"] },
      count: { type: "number", minimum: 0 },
      removed: { type: "string" },
    }, ["status", "count", "removed"]),
  });
  const current = contract({
    inputSchema: objectSchema({
      choice: { type: "string", enum: ["a"], maxLength: 10 },
      count: { type: "number", minimum: 1 },
      conditional: { type: "string", anyOf: [{ const: "a" }] },
      newRequired: { type: "string" },
    }, ["choice", "newRequired"]),
    outputSchema: objectSchema({
      status: { type: "string", enum: ["ready", "failed"] },
      count: { type: "number", minimum: -1 },
    }, ["status"]),
    outputTemplate: "ui://changed",
    resourceUri: "ui://changed",
    mimeType: "application/xhtml+xml",
    modernDomains: ["https://new.example"],
    legacyDomains: ["https://new.example"],
    description: "Changed public description.",
  });
  current.resources[0].contents[0].uri = "ui://changed-content";
  const baselines = [{ version: "1.0.0", contract: baseline }, { version: "marketplace-review", contract: baseline }];
  const breaks = comparePublishedMcpContracts(current, baselines);
  for (const kind of [
    "input-enum-changed", "input-constraint-changed", "input-field-now-required",
    "output-enum-changed", "output-constraint-changed", "field-removed", "output-field-now-optional",
    "unclassified-schema-change", "contract-field-changed", "resource-uri-changed", "output-template-changed",
    "ui-metadata-changed", "mime-type-changed", "csp-widened",
  ]) assert.ok(breaks.some((item) => item.kind === kind), `missing ${kind}`);
  assert.deepEqual(new Set(breaks.map(({ version }) => version)), new Set(["1.0.0", "marketplace-review"]));
  assert.throws(
    () => assertPublishedMcpContractCompatible(current, baselines),
    (error) => error.message.includes("[1.0.0]")
      && error.message.includes("[input-field-now-required]")
      && error.message.includes("https://new.example"),
  );
});

test("fails closed when discovery repeats a pagination cursor", async () => {
  const client = {
    listTools: async () => ({ tools: [], nextCursor: "again" }),
    listResources: async () => ({ resources: [] }),
    readResource: async () => ({ contents: [] }),
  };
  await assert.rejects(() => extractPublishedMcpContract(client), /repeated cursor again/);
});

function objectSchema(properties, required) {
  return { type: "object", additionalProperties: false, properties, required };
}

function contract({
  inputSchema,
  outputSchema,
  outputTemplate = "ui://app",
  resourceUri = "ui://app",
  mimeType = "text/html",
  modernDomains = [],
  legacyDomains = [],
  description = "Do work.",
}) {
  return {
    tools: [{
      name: "do-work",
      description,
      inputSchema,
      outputSchema,
      _meta: { ui: { resourceUri }, "openai/outputTemplate": outputTemplate },
    }],
    resources: [{
      name: "app",
      uri: "ui://app",
      mimeType,
      _meta: { ui: { resourceUri } },
      contents: [{
        uri: "ui://app",
        mimeType,
        _meta: {
          ui: { resourceUri, csp: { connectDomains: modernDomains } },
          "openai/widgetCSP": { connect_domains: legacyDomains },
        },
      }],
    }],
  };
}
