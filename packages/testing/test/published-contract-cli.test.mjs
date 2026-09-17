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
