import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createEmseepea, defineTool } from "@emseepea/server";
import { z } from "zod";
import { insecureTestAuthentication, startEmseepea } from "../dist/index.js";

const cli = fileURLToPath(new URL("../published-contract/cli.mjs", import.meta.url));
const factory = new URL("./published-contract-app.mjs", import.meta.url);

test("captures and checks every discovered baseline without exposing authentication", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = join(directory, "1.0.0.json");
  const secret = "CONTRACT_TOKEN_SENTINEL";
  const source = ["--factory", factory.pathname, "--factory-export", "createContractApp", "--token-env", "MCP_TOKEN"];

  const captured = await run(["capture", ...source, "--version", "1.0.0", "--baseline", first], { MCP_TOKEN: secret });
  assert.equal(captured.code, 0, captured.stderr);
  assert.doesNotMatch(captured.stdout + captured.stderr + await readFile(first, "utf8"), new RegExp(secret));

  const second = join(directory, "2.0.0.json");
  await writeFile(second, (await readFile(first, "utf8")).replace('"1.0.0"', '"2.0.0"'));
  const checked = await run(["check", ...source, "--baselines", directory], { MCP_TOKEN: secret });
  assert.equal(checked.code, 0, checked.stderr);
  assert.match(checked.stdout, /compatible with 2 baseline/);

  const broken = await run(["check", ...source, "--baselines", directory], {
    MCP_TOKEN: secret,
    CONTRACT_DESCRIPTION: "Changed public description.",
  });
  assert.equal(broken.code, 1);
  assert.match(broken.stderr, /\[1\.0\.0\].*\[contract-field-changed\]/s);
  assert.match(broken.stderr, /\[2\.0\.0\].*\[contract-field-changed\]/s);
  assert.doesNotMatch(broken.stdout + broken.stderr, new RegExp(secret));
});

test("returns usage error status for incomplete commands", async () => {
  const result = await run(["check", "--factory", factory.pathname]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /requires --baselines/);
});

test("keeps default baseline validation and diagnostics sequential", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-contract-default-order-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "1-invalid-envelope.json"), JSON.stringify({ legacy: true }));
  await writeFile(join(directory, "2-malformed.json"), "{");

  const result = await run([
    "check", "--factory", factory.pathname, "--factory-export", "createContractApp",
    "--baselines", directory,
  ]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /Invalid published MCP contract baseline:.*1-invalid-envelope\.json/);
  assert.doesNotMatch(result.stderr, /Unexpected end of JSON input/);
});

test("delegates legacy migration, normalization, and comparison to an opt-in check policy", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-contract-policy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const capturedFile = join(directory, "captured.json");
  const source = ["--factory", factory.pathname, "--factory-export", "createContractApp"];
  const captured = await run(["capture", ...source, "--version", "captured", "--baseline", capturedFile]);
  assert.equal(captured.code, 0, captured.stderr);
  const current = JSON.parse(await readFile(capturedFile, "utf8"));
  await rm(capturedFile);

  const legacy = {
    baseline: { openAiSubmissionVersion: "legacy" },
    tools: structuredClone(current.contract.tools),
    resources: current.contract.resources,
  };
  legacy.tools[0].outputSchema.properties = {};
  await writeFile(join(directory, "2.0.0.json"), JSON.stringify({
    ...legacy,
    baseline: { openAiSubmissionVersion: "2.0.0" },
  }));
  await writeFile(join(directory, "1.0.0.json"), JSON.stringify({
    ...legacy,
    baseline: { openAiSubmissionVersion: "1.0.0" },
  }));

  const defaultCheck = await run(["check", ...source, "--baselines", directory]);
  assert.equal(defaultCheck.code, 2);
  assert.match(defaultCheck.stderr, /Invalid published MCP contract baseline/);

  const policy = join(directory, "policy.mjs");
  await writeFile(policy, `
    import { comparePublishedMcpContracts } from ${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)};

    const normalize = (contract) => ({
      tools: contract.tools.map(({ name, description, inputSchema, outputSchema, _meta }) => ({
        name, description, inputSchema, outputSchema, ...(_meta ? { _meta } : {}),
      })),
      resources: contract.resources,
    });

    export async function checkPublishedMcpContracts({ current, baselines, ...control }) {
      if (Object.keys(control).length > 0 || "token" in control) throw new Error("command control leaked");
      const files = baselines.map(({ file }) => file);
      if (files.join("\\n") !== files.toSorted().join("\\n")) throw new Error("baselines are not sorted");
      const migrated = baselines.map(({ value }) => ({
        version: value.baseline.openAiSubmissionVersion,
        contract: normalize({ tools: value.tools, resources: value.resources }),
      }));
      return comparePublishedMcpContracts(normalize(current), migrated)
        .filter(({ kind }) => kind !== "output-field-added");
    }
  `);

  const checked = await run(["check", ...source, "--baselines", directory, "--policy", policy]);
  assert.equal(checked.code, 0, checked.stderr);
  assert.match(checked.stdout, /compatible with 2 baseline/);

  const broken = await run(["check", ...source, "--baselines", directory, "--policy", policy], {
    CONTRACT_DESCRIPTION: "Changed public description.",
  });
  assert.equal(broken.code, 1);
  assert.match(broken.stderr, /\[1\.0\.0\].*\[contract-field-changed\]/s);
  assert.match(broken.stderr, /\[2\.0\.0\].*\[contract-field-changed\]/s);
});

test("keeps policy failures, redaction, and capture under command control", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-contract-policy-errors-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseline = join(directory, "baseline.json");
  const source = ["--factory", factory.pathname, "--factory-export", "createContractApp", "--token-env", "MCP_TOKEN"];
  const secret = "POLICY_TOKEN_SENTINEL";
  const captured = await run(["capture", ...source, "--version", "1.0.0", "--baseline", baseline], { MCP_TOKEN: secret });
  assert.equal(captured.code, 0, captured.stderr);

  const missingExport = join(directory, "missing-export.mjs");
  await writeFile(missingExport, "export const other = true;\n");
  const malformed = join(directory, "malformed.mjs");
  await writeFile(malformed, "export const checkPublishedMcpContracts = () => [{}];\n");
  const throwing = join(directory, "throwing.mjs");
  await writeFile(throwing, "export const checkPublishedMcpContracts = () => { throw new Error(process.env.MCP_TOKEN); };\n");

  for (const [policy, diagnostic] of [
    [join(directory, "absent.mjs"), /Cannot find module/],
    [missingExport, /does not export checkPublishedMcpContracts as a function/],
    [malformed, /returned an invalid compatibility break/],
    [throwing, /\[redacted\]/],
  ]) {
    const result = await run(["check", ...source, "--baselines", directory, "--policy", policy], { MCP_TOKEN: secret });
    assert.equal(result.code, 2);
    assert.match(result.stderr, diagnostic);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
  }

  const rejected = join(directory, "rejected.json");
  const capture = await run([
    "capture", ...source, "--version", "rejected", "--baseline", rejected, "--policy", malformed,
  ], { MCP_TOKEN: secret });
  assert.equal(capture.code, 2);
  assert.match(capture.stderr, /capture does not accept --policy/);
  await assert.rejects(readFile(rejected, "utf8"), { code: "ENOENT" });
});

test("captures a protected MCP URL with a token supplied only through the environment", async (t) => {
  const running = await startEmseepea(t, createEmseepea({
    name: "protected-contract-command-test",
    version: "0.0.0",
    authentication: insecureTestAuthentication(["contracts:read"]),
    tools: [defineTool({
      name: "protected-contract",
      access: "protected",
      requiredScopes: ["contracts:read"],
      description: "Expose the protected contract.",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      handler: () => ({ data: { ok: true } }),
    })],
  }));
  const directory = await mkdtemp(join(tmpdir(), "emseepea-contract-url-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseline = join(directory, "protected.json");
  const secret = "PROTECTED_CONTRACT_TOKEN_SENTINEL";

  const result = await run([
    "capture", "--url", running.url.href, "--token-env", "MCP_TOKEN",
    "--version", "protected", "--baseline", baseline,
  ], { MCP_TOKEN: secret });

  assert.equal(result.code, 0, result.stderr);
  const stored = await readFile(baseline, "utf8");
  assert.match(stored, /protected-contract/);
  assert.doesNotMatch(result.stdout + result.stderr + stored, new RegExp(secret));
});

function run(args, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
