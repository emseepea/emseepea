import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../../", import.meta.url);

function run(command, args, cwd) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 120_000, env: environment });
  assert.equal(result.status, 0, [command, String(cwd), result.error?.code, result.signal, result.stdout, result.stderr].filter(Boolean).join("\n"));
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

test("every copied example runs against packed packages", { timeout: 900_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-example-"));
  try {
    const tarballs = new Map(await Promise.all([
      ["@emseepea/server", "./packages/framework"],
      ["@emseepea/testing", "./packages/testing"],
      ["@emseepea/react", "./packages/react"],
      ["@emseepea/tailwind", "./packages/tailwind"],
      ["@emseepea/example-ui-shared", "./examples/ui-shared"],
    ].map(async ([name, packagePath]) => [name, await packPackage(packagePath, directory)])));
    const fakeModel = path.join(directory, "fake-model.mjs");
    await writeFile(fakeModel, fakeModelSource, { mode: 0o700 });

    for (const name of [
      "basic-no-ui",
      "backend-no-ui",
      "protected-no-ui",
      "resources-prompts",
      "streaming-progress",
      "multi-instance",
      "native-ui",
      "react-tailwind-ui",
    ]) {
      const example = path.join(directory, name);
      await cp(new URL(`../../examples/${name}/`, import.meta.url), example, {
        recursive: true,
        filter: (source) => !/(^|\/)(dist|node_modules|artifacts|.* 2\.[^/]+)$/.test(source),
      });
      const manifest = JSON.parse(await readFile(path.join(example, "package.json"), "utf8"));
      const internalPackages = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
        .filter((dependency) => tarballs.has(dependency))
        .map((dependency) => tarballs.get(dependency));

      run("npm", [
        "install",
        "--ignore-scripts",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
        ...internalPackages,
      ], example);
      run("npm", ["run", "lint"], example);
      run("npm", ["test"], example);
      run("npx", [
        "--no-install",
        "emseepea-test",
        "--smoke",
        "--model-command",
        fakeModel,
        "--output",
        "artifacts/smoke.json",
        "eval",
      ], example);

      const evidence = JSON.parse(await readFile(path.join(example, "artifacts/smoke.json"), "utf8"));
      const result = Object.values(evidence.cases)[0];
      assert.equal(evidence.status, "passed", `${name} semantic smoke failed`);
      assert.equal(result.answerTrials.length, 3);
      assert.equal(result.judgeVerdicts.length, 9);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const fakeModelSource = `#!/usr/bin/env node
const prompt = process.argv[process.argv.indexOf("--print") + 1] ?? "";
const answer = prompt.includes("Return only JSON with this exact shape")
  ? '{"pass":true,"score":1,"reason":"The answer preserves every required meaning."}'
  : prompt.includes("reusesOriginalReport (boolean)")
    ? JSON.stringify({ createdByInstance: "eval-instance", totalBeans: 4,
        roastCounts: { light: 1, medium: 2, dark: 1 },
        reusesOriginalReport: true, createsAnotherReport: false })
    : prompt;
process.stdout.write(JSON.stringify({
  type: "result",
  is_error: false,
  num_turns: 1,
  permission_denials: [],
  result: answer,
  modelUsage: { "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" } },
}) + "\\n");
`;

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
