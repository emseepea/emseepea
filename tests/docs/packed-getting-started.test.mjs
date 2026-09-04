import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
import test from "node:test";

import { initializerPackages } from "../../scripts/public-packages.mjs";

const root = new URL("../../", import.meta.url);
const skipPackedAudit = process.env.EMSEEPEA_SKIP_PACKED_AUDIT;
const skipInitializers = process.env.EMSEEPEA_SKIP_PACKED_INITIALIZERS;
assert.ok(skipPackedAudit === undefined || skipPackedAudit === "true", "invalid packed audit skip value");
assert.ok(skipInitializers === undefined || skipInitializers === "true", "invalid initializer skip value");

function run(command, args, cwd) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const timeout = command === "npm" && ["audit", "exec", "install"].includes(args[0]) ? 600_000 : 120_000;
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, env: environment });
  assert.equal(result.status, 0, [command, String(cwd), result.error?.code, result.signal, result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout;
}

function runAsync(command, args, cwd) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const timeout = command === "npm" && ["audit", "exec", "install"].includes(args[0]) ? 600_000 : 120_000;
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: "utf8", timeout, env: environment }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([command, String(cwd), error.code, error.signal, stdout, stderr].filter(Boolean).join("\n"), { cause: error }));
      } else {
        resolve(stdout);
      }
    });
  });
}

test("the packed public packages pass fresh-install and getting-started checks", { timeout: 900_000 }, async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-packed-"));
  try {
    const tarballs = await Promise.all([
      packPackage("./packages/framework", directory),
      packPackage("./packages/testing", directory),
    ]);

    run("npm", ["init", "--yes"], directory);
    run("npm", [
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--userconfig", "/dev/null",
      ...tarballs,
      "zod@4.4.3",
    ], directory);
    await t.test("the fresh install passes audit", { skip: skipPackedAudit === "true" }, () => {
      run("npm", ["audit", "--audit-level=high", "--userconfig", "/dev/null"], directory);
    });

    await writeFile(path.join(directory, "check.mjs"), `
      import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
      import { startMcpServer } from "@emseepea/testing";
      import { semanticTest, toolSelectionTest } from "@emseepea/testing/semantic";
      import { z } from "zod";

      if (typeof startMcpServer !== "function" || typeof semanticTest !== "function"
          || typeof toolSelectionTest !== "function") {
        throw new Error("packed testing package is missing its public helpers");
      }
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
    await cp(new URL("scripts/verify-installed-package.mjs", root), path.join(directory, "verify-installed-package.mjs"));
    run(process.execPath, ["verify-installed-package.mjs"], directory);
    const installed = JSON.parse(await readFile(path.join(directory, "node_modules/@emseepea/server/package.json"), "utf8"));
    assert.equal(installed.name, "@emseepea/server");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the packed React renderer installs and preserves embedded form semantics", { timeout: 180_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-packed-react-"));
  try {
    const server = await packPackage("./packages/framework", directory);
    const react = await packPackage("./packages/react", directory);
    run("npm", ["init", "--yes"], directory);
    run("npm", [
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--userconfig", "/dev/null",
      server,
      react,
      "react@19.2.8",
      "react-dom@19.2.8",
    ], directory);
    await writeFile(path.join(directory, "check.mjs"), `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { ElicitationForm } from "@emseepea/react";

      const view = {
        id: "packed-react",
        heading: "Preview a report",
        legend: "Report options",
        submitLabel: "Create preview",
        fields: [{
          kind: "text",
          id: "title",
          name: "title",
          label: "Report title",
          description: "Name this preview.",
          required: true,
        }],
        state: { kind: "ready", focusTarget: "none" },
      };
      const html = renderToStaticMarkup(createElement(ElicitationForm, { view, headingLevel: 2 }));
      if (!html.includes('<h2 id="packed-react--heading">Preview a report</h2>')) throw new Error("missing heading");
      if (!html.includes('<label for="packed-react--field--title">Report title')) throw new Error("missing label");
      if (!html.includes('required=""') || !html.includes('aria-describedby="packed-react--field--title--description"')) {
        throw new Error("missing required-field semantics");
      }
      if (!html.includes('role="status"') || !html.includes('aria-live="polite"')) throw new Error("missing status semantics");
      if (/<(?:html|title|main|h1)\\b/.test(html)) throw new Error("renderer owns the page shell");
    `);
    run(process.execPath, ["check.mjs"], directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the packed Tailwind stylesheet installs with its accessibility states and limits", { timeout: 180_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-packed-tailwind-"));
  try {
    const tailwind = await packPackage("./packages/tailwind", directory);
    run("npm", ["init", "--yes"], directory);
    run("npm", [
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--userconfig", "/dev/null",
      tailwind,
    ], directory);
    await writeFile(path.join(directory, "check.mjs"), `
      import { readFile } from "node:fs/promises";
      import { gzipSync } from "node:zlib";

      const css = await readFile(new URL(import.meta.resolve("@emseepea/tailwind/styles.css")), "utf8");
      for (const pattern of [":focus-visible", ":required", "[aria-invalid=true]", "[aria-busy=true]", "forced-colors:active", "prefers-reduced-motion:reduce"]) {
        if (!css.includes(pattern)) throw new Error(\`missing stylesheet state: \${pattern}\`);
      }
      if (Buffer.byteLength(css) > 10 * 1024) throw new Error("raw stylesheet limit exceeded");
      if (gzipSync(css).byteLength > 3 * 1024) throw new Error("gzip stylesheet limit exceeded");
    `);
    run(process.execPath, ["check.mjs"], directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("every packed initializer creates a standalone checked project", {
  skip: skipInitializers === "true",
  timeout: 2_700_000,
}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-example-"));
  try {
    const tarballs = new Map(await Promise.all([
      ["@emseepea/server", "./packages/framework"],
      ["@emseepea/testing", "./packages/testing"],
      ["@emseepea/react", "./packages/react"],
      ["@emseepea/tailwind", "./packages/tailwind"],
      ...initializerPackages.map(({ name, path: packagePath }) => [name, `./${packagePath}`]),
    ].map(async ([name, packagePath]) => [name, await packPackage(packagePath, directory)])));
    const fakeModel = path.join(directory, "fake-model.mjs");
    await cp(new URL("../fixtures/fake-semantic-model.mjs", import.meta.url), fakeModel);
    const expectedTools = {
      "backend-no-ui": ["search-coffee-catalog"],
      "basic-no-ui": ["get-bean-details"],
      "multi-instance": ["create-shared-bean-report", "create-shared-bean-report"],
      "native-ui": ["preview-bean-report"],
      "protected-no-ui": ["get-private-inventory-report"],
      "react-tailwind-ui": ["preview-bean-report"],
      "streaming-progress": ["roast-sample-batch"],
    };

    const queue = [...initializerPackages];
    const failures = [];
    const verify = async (initializer) => {
      const parent = path.join(directory, initializer.key);
      await mkdir(parent);
      await runAsync("npm", [
        "exec",
        "--yes",
        "--offline",
        "--userconfig", "/dev/null",
        "--package", tarballs.get(initializer.name),
        "--",
        initializer.key,
        "my-server",
      ], parent);
      const example = path.join(parent, "my-server");
      const manifest = JSON.parse(await readFile(path.join(example, "package.json"), "utf8"));
      assert.equal(manifest.name, "my-server");
      assert.equal(manifest.private, true);
      const internalPackages = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
        .filter((dependency) => tarballs.has(dependency))
        .map((dependency) => tarballs.get(dependency));
      assert.equal(
        Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }).some(([name, version]) => (
          name.startsWith("@emseepea/example-") || /^(?:file:|workspace:|\.\.?[\\/])/.test(version)
        )),
        false,
      );

      await runAsync("npm", [
        "install",
        "--no-save",
        "--ignore-scripts",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
        ...internalPackages,
      ], example);
      await runAsync("npm", ["run", "lint"], example);
      await runAsync("npm", ["test"], example);
      await runAsync("npx", [
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
      assert.equal(evidence.status, "passed", `${initializer.example} semantic smoke failed`);
      assert.equal(result.answerTrials.length, 3);
      assert.equal(result.judgeVerdicts.length, 9);
      if (initializer.example === "resources-prompts") {
        assert.equal(result.mode, "prepared");
      } else {
        assert.equal(result.mode, "tool-selection");
        for (const trial of result.answerTrials) {
          assert.deepEqual(trial.expectedTools, expectedTools[initializer.example]);
          assert.deepEqual(trial.selectedTools, expectedTools[initializer.example]);
        }
      }
    };

    // Four workers keep the GitHub runner busy without running all browser and install checks at once.
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length > 0) {
        const initializer = queue.shift();
        try {
          await verify(initializer);
        } catch (error) {
          failures.push(error);
          return;
        }
      }
    }));
    if (failures.length > 0) throw failures[0];
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
