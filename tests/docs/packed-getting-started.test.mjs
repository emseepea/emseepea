import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test("the packed server runs the public getting-started path", { timeout: 180_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-packed-"));
  try {
    const packed = JSON.parse(run("npm", [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      directory,
      "./packages/framework",
    ], root));
    const tarball = path.join(directory, packed[0].filename);

    run("npm", ["init", "--yes"], directory);
    run("npm", [
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      tarball,
      "zod@4.4.3",
    ], directory);

    await writeFile(path.join(directory, "check.mjs"), `
      import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
      import { z } from "zod";

      const value = z.object({ value: z.string() });
      const tool = defineTool({
        name: "echo-value",
        access: "public",
        description: "Return one value.",
        inputSchema: value,
        outputSchema: value,
        handler: ({ value }) => ({ text: value, data: { value } }),
      });
      const app = createEmseepea({ name: "packed-check", version: "0.0.0", tools: [tool] });
      const running = await serveEmseepea(app, { port: 0 });
      try {
        const response = await fetch(running.url, {
          method: "POST",
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2026-07-28",
            "Mcp-Method": "tools/call",
            "Mcp-Name": "echo-value",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "packed-check",
            method: "tools/call",
            params: {
              name: "echo-value",
              arguments: { value: "installed package works" },
              _meta: {
                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                "io.modelcontextprotocol/clientInfo": { name: "packed-check", version: "0.0.0" },
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            },
          }),
        });
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        const body = await response.json();
        if (body.result?.structuredContent?.value !== "installed package works") {
          throw new Error("packed package returned the wrong value");
        }
      } finally {
        await running.close();
      }
    `);

    run(process.execPath, ["check.mjs"], directory);
    const installed = JSON.parse(await readFile(path.join(directory, "node_modules/@emseepea/server/package.json"), "utf8"));
    assert.equal(installed.name, "@emseepea/server");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a copied example owns deterministic and semantic checks", { timeout: 300_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-example-"));
  try {
    const serverTarball = await packPackage("./packages/framework", directory);
    const testingTarball = await packPackage("./packages/testing", directory);
    const example = path.join(directory, "basic-no-ui");
    await cp(new URL("../../examples/basic-no-ui/", import.meta.url), example, {
      recursive: true,
      filter: (source) => !/(^|\/)(dist|node_modules|.* 2\.[^/]+)$/.test(source),
    });

    run("npm", [
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      serverTarball,
      testingTarball,
    ], example);
    run("npm", ["run", "lint"], example);
    run("npm", ["test"], example);
    run("npx", [
      "--no-install",
      "emseepea-test",
      "--smoke",
      "--model-command",
      fileURLToPath(new URL("../../packages/testing/test/fake-model.mjs", import.meta.url)),
      "--output",
      "artifacts/smoke.json",
      "eval.yaml",
    ], example);

    const evidence = JSON.parse(await readFile(path.join(example, "artifacts/smoke.json"), "utf8"));
    const result = Object.values(evidence.cases)[0];
    assert.equal(evidence.status, "passed");
    assert.equal(result.agentTrials.length, 3);
    assert.equal(result.judgeVerdicts.length, 9);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function packPackage(packagePath, directory) {
  const packed = JSON.parse(run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    directory,
    packagePath,
  ], root));
  return path.join(directory, packed[0].filename);
}
