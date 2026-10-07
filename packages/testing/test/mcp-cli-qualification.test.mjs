import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  createEmseepea,
  defineResource,
  defineResourceTemplate,
  defineStreamingTool,
  defineTool,
} from "@emseepea/server";
import { z } from "zod";

import {
  runMcpCliQualification,
  startEmseepea,
} from "../dist/index.js";

const execute = promisify(execFile);
const permissions = ["fixtures:read"];
const fixtureUri = "fixture://documents/original.pdf";
const fixtureBytes = Buffer.from("%PDF-1.4\nsynthetic qualification fixture\n", "utf8");
const fixtureHash = sha256(fixtureBytes);

test("qualifies protocol catalogues, bytes, links, progress, denial and cancellation", async (t) => {
  const running = await startQualificationServer(t);
  process.env.EMSEEPEA_OWNER_TOKEN = "owner-secret-sentinel";
  process.env.EMSEEPEA_LIMITED_TOKEN = "limited-secret-sentinel";
  t.after(() => {
    delete process.env.EMSEEPEA_OWNER_TOKEN;
    delete process.env.EMSEEPEA_LIMITED_TOKEN;
  });
  const directory = await mkdtemp(join(tmpdir(), "emseepea-mcp-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "evidence.json");
  await writeFile(output, "previous evidence\n", { mode: 0o644 });
  await chmod(output, 0o644);

  const evidence = await runMcpCliQualification(scenario(running.url), output);

  assert.equal(evidence.status, "passed", JSON.stringify(evidence));
  assert.equal(evidence.evidenceKind, "mcp-cli");
  assert.equal(evidence.nativeChatgpt, "not-tested");
  assert.deepEqual(evidence.checkpoints.map(({ status }) => status),
    Array.from({ length: evidence.checkpoints.length }, () => "passed"));
  const resource = evidence.checkpoints.find(({ id }) => id === "read-original");
  assert.equal(resource.observation.contents[0].sha256, fixtureHash);
  assert.equal(resource.observation.contents[0].bytes, fixtureBytes.byteLength);
  const progress = evidence.checkpoints.find(({ id }) => id === "progress-completes");
  assert.equal(progress.observation.progressCount, 2);
  const saved = await readFile(output, "utf8");
  assert.equal(saved.includes("owner-secret-sentinel"), false);
  assert.equal(saved.includes("limited-secret-sentinel"), false);
  assert.equal(saved.includes(running.url.href), false);
  assert.equal(saved.includes(fixtureUri), false);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
});

test("the CLI loads an adopter scenario and keeps native ChatGPT explicitly untested", async (t) => {
  const running = await startQualificationServer(t);
  const directory = await mkdtemp(join(tmpdir(), "emseepea-mcp-cli-command-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scenarioFile = join(directory, "scenario.mjs");
  const output = join(directory, "evidence.json");
  await writeFile(scenarioFile, `export default {
  name: "synthetic packed command",
  endpoint: new URL(${JSON.stringify(running.url.href)}),
  tokenEnvironment: "EMSEEPEA_OWNER_TOKEN",
  checkpoints: [{
    id: "tools",
    operation: "tools/list",
    expectedNames: ["get-original", "many-links", "run-progress", "wait-for-cancel"],
  }],
};\n`);

  const result = await execute(process.execPath, [
    new URL("../mcp-cli/cli.mjs", import.meta.url).pathname,
    "--scenario", scenarioFile,
    "--output", output,
  ], {
    env: { ...process.env, EMSEEPEA_OWNER_TOKEN: "cli-secret-sentinel" },
  });
  assert.match(result.stdout, /MCP CLI qualification passed/);
  const saved = await readFile(output, "utf8");
  assert.equal(saved.includes("cli-secret-sentinel"), false);
  assert.equal(JSON.parse(saved).nativeChatgpt, "not-tested");
});

test("missing credentials and declared gaps remain blocked or incomplete", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-mcp-cli-gaps-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  delete process.env.EMSEEPEA_ABSENT_TOKEN;
  const evidence = await runMcpCliQualification({
    name: "explicit gaps",
    endpoint: new URL("https://example.invalid/mcp"),
    checkpoints: [
      { id: "missing-auth", operation: "tools/list", tokenEnvironment: "EMSEEPEA_ABSENT_TOKEN" },
      { id: "missing-fixture", operation: "record", outcome: "incomplete", category: "missing-fixture" },
    ],
  }, join(directory, "evidence.json"));
  assert.equal(evidence.status, "blocked");
  assert.deepEqual(evidence.checkpoints.map(({ status }) => status), ["blocked", "incomplete"]);
});

test("refuses to write evidence containing a configured credential", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-mcp-cli-secret-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  process.env.EMSEEPEA_EVIDENCE_TOKEN = "evidence-secret-sentinel";
  t.after(() => { delete process.env.EMSEEPEA_EVIDENCE_TOKEN; });
  await assert.rejects(runMcpCliQualification({
    name: "evidence-secret-sentinel",
    endpoint: new URL("https://example.invalid/mcp"),
    tokenEnvironment: "EMSEEPEA_EVIDENCE_TOKEN",
    checkpoints: [{ id: "known-gap", operation: "record", outcome: "incomplete", category: "not-run" }],
  }, join(directory, "evidence.json")), /contains a configured credential/);
  await assert.rejects(readFile(join(directory, "evidence.json")));
});

test("rejects credentials embedded in endpoint URLs", async () => {
  await assert.rejects(runMcpCliQualification({
    name: "unsafe endpoint",
    endpoint: new URL("https://user:password@example.invalid/mcp"),
    checkpoints: [{ id: "known-gap", operation: "record", outcome: "incomplete", category: "not-run" }],
  }, "ignored.json"), /must not contain credentials/);
  await assert.rejects(runMcpCliQualification({
    name: "unsafe query",
    endpoint: new URL("https://example.invalid/mcp?access_token=secret"),
    checkpoints: [{ id: "known-gap", operation: "record", outcome: "incomplete", category: "not-run" }],
  }, "ignored.json"), /credential-like query/);
  await assert.rejects(runMcpCliQualification({
    name: "remote plain HTTP",
    endpoint: new URL("http://example.invalid/mcp"),
    checkpoints: [{ id: "known-gap", operation: "record", outcome: "incomplete", category: "not-run" }],
  }, "ignored.json"), /must use a loopback host/);
});

test("does not mistake an unknown resource for access denial", async (t) => {
  const running = await startQualificationServer(t);
  process.env.EMSEEPEA_OWNER_TOKEN = "owner-secret-sentinel";
  t.after(() => { delete process.env.EMSEEPEA_OWNER_TOKEN; });
  const directory = await mkdtemp(join(tmpdir(), "emseepea-mcp-cli-unknown-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const evidence = await runMcpCliQualification({
    name: "unknown resource",
    endpoint: running.url,
    tokenEnvironment: "EMSEEPEA_OWNER_TOKEN",
    checkpoints: [{
      id: "unknown-resource",
      operation: "resources/read",
      uri: "fixture://documents/missing.pdf",
      expect: "denied",
    }],
  }, join(directory, "evidence.json"));
  assert.equal(evidence.status, "failed");
  assert.notEqual(evidence.checkpoints[0].category, "denial-observed");
});

test("fails closed on oversized observed content and link collections", async (t) => {
  const running = await startQualificationServer(t);
  process.env.EMSEEPEA_OWNER_TOKEN = "owner-secret-sentinel";
  t.after(() => { delete process.env.EMSEEPEA_OWNER_TOKEN; });
  const directory = await mkdtemp(join(tmpdir(), "emseepea-mcp-cli-bounds-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "evidence.json");
  const evidence = await runMcpCliQualification({
    name: "bounded observations",
    endpoint: running.url,
    tokenEnvironment: "EMSEEPEA_OWNER_TOKEN",
    checkpoints: [
      { id: "many-contents", operation: "resources/read", uri: "fixture://documents/many-contents" },
      { id: "many-links", operation: "tools/call", name: "many-links" },
    ],
  }, output);
  assert.equal(evidence.status, "failed");
  assert.deepEqual(evidence.checkpoints.map(({ status }) => status), ["failed", "failed"]);
  assert.ok((await stat(output)).size < 8_192);
});

function scenario(endpoint) {
  return {
    name: "synthetic MCP CLI journey",
    endpoint,
    tokenEnvironment: "EMSEEPEA_OWNER_TOKEN",
    checkpoints: [
      { id: "oauth", operation: "oauth/discover", expectedScopes: permissions },
      {
        id: "tools",
        operation: "tools/list",
        expectedNames: ["get-original", "many-links", "run-progress", "wait-for-cancel"],
      },
      {
        id: "resources",
        operation: "resources/list",
        expectedUris: [fixtureUri, "fixture://documents/many-contents"],
      },
      {
        id: "templates",
        operation: "resources/templates/list",
        expectedUriTemplates: ["fixture://templates/{name}"],
      },
      {
        id: "read-original",
        operation: "resources/read",
        uri: fixtureUri,
        expectedContents: [{ sha256: fixtureHash, bytes: fixtureBytes.byteLength, mimeType: "application/pdf" }],
      },
      {
        id: "tool-link",
        operation: "tools/call",
        name: "get-original",
        expectedResourceLinks: [{ uri: fixtureUri, mimeType: "application/pdf" }],
      },
      {
        id: "progress-completes",
        operation: "tools/call",
        name: "run-progress",
        minimumProgress: 2,
      },
      {
        id: "limited-token-denied",
        operation: "resources/read",
        uri: fixtureUri,
        tokenEnvironment: "EMSEEPEA_LIMITED_TOKEN",
        expect: "denied",
      },
      {
        id: "cancellation",
        operation: "tools/call",
        name: "wait-for-cancel",
        cancelAfterMs: 10,
        expect: "cancelled",
      },
    ],
  };
}

async function startQualificationServer(t) {
  const access = { access: "protected", requiredScopes: permissions };
  const app = createEmseepea({
    name: "mcp-cli-qualification-fixture",
    version: "0.0.0",
    authentication: {
      discovery: "protected",
      verifier: {
        async verifyAccessToken(token) {
          return {
            token,
            clientId: "qualification-test",
            scopes: token === "limited-secret-sentinel" ? [] : permissions,
            expiresAt: Math.floor(Date.now() / 1000) + 60,
            resource: new URL("https://test.example/mcp"),
          };
        },
      },
      metadata: {
        resourceServerUrl: new URL("https://test.example/mcp"),
        scopesSupported: permissions,
        oauthMetadata: {
          issuer: "https://auth.test.example",
          authorization_endpoint: "https://auth.test.example/authorize",
          token_endpoint: "https://auth.test.example/token",
          response_types_supported: ["code"],
        },
      },
    },
    resources: [
      defineResource({
        ...access,
        name: "original-pdf",
        uri: fixtureUri,
        mimeType: "application/pdf",
        handler: () => ({
          contents: [{ uri: fixtureUri, mimeType: "application/pdf", blob: fixtureBytes.toString("base64") }],
        }),
      }),
      defineResource({
        ...access,
        name: "many-contents",
        uri: "fixture://documents/many-contents",
        mimeType: "text/plain",
        handler: () => ({
          contents: Array.from({ length: 129 }, (_, index) => ({
            uri: `fixture://documents/many-contents/${index}`,
            mimeType: "text/plain",
            text: "x",
          })),
        }),
      }),
      defineResourceTemplate({
        access: "public",
        name: "document-by-name",
        uriTemplate: "fixture://templates/{name}",
        mimeType: "application/pdf",
        handler: ({ uri }) => ({
          contents: [{ uri, mimeType: "application/pdf", blob: fixtureBytes.toString("base64") }],
        }),
      }),
    ],
    tools: [
      defineTool({
        ...access,
        name: "get-original",
        description: "Return a link to the synthetic original fixture.",
        inputSchema: z.object({}),
        handler: () => ({
          content: [{ type: "resource_link", name: "original-pdf", uri: fixtureUri, mimeType: "application/pdf" }],
        }),
      }),
      defineTool({
        ...access,
        name: "many-links",
        description: "Return more links than bounded evidence accepts.",
        inputSchema: z.object({}),
        handler: () => ({
          content: Array.from({ length: 129 }, (_, index) => ({
            type: "resource_link",
            name: `resource-${index}`,
            uri: `fixture://documents/${index}`,
            mimeType: "text/plain",
          })),
        }),
      }),
      defineStreamingTool({
        ...access,
        name: "run-progress",
        description: "Emit bounded progress and complete.",
        inputSchema: z.object({}),
        outputSchema: z.object({ status: z.literal("complete") }),
        async handler(_input, { reportProgress }) {
          await reportProgress({ progress: 1, total: 2, message: "first" });
          await reportProgress({ progress: 2, total: 2, message: "second" });
          return { data: { status: "complete" } };
        },
      }),
      defineStreamingTool({
        ...access,
        name: "wait-for-cancel",
        description: "Wait until the qualification client cancels.",
        inputSchema: z.object({}),
        outputSchema: z.object({ status: z.literal("complete") }),
        async handler(_input, { signal }) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 2_000);
            signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(signal.reason);
            }, { once: true });
          });
          return { data: { status: "complete" } };
        },
      }),
    ],
  });
  return startEmseepea(t, app);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
