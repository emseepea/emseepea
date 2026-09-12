import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";
import test from "node:test";

import { initializerPackages } from "../../scripts/public-packages.mjs";

const root = new URL("../../", import.meta.url);
const skipInitializers = process.env.EMSEEPEA_SKIP_PACKED_INITIALIZERS;
const verifyContainers = process.env.EMSEEPEA_VERIFY_CONTAINERS;
const containerExample = process.env.EMSEEPEA_CONTAINER_EXAMPLE;
assert.ok(skipInitializers === undefined || skipInitializers === "true", "invalid initializer skip value");
assert.ok(verifyContainers === undefined || verifyContainers === "true", "invalid container verification value");
const selectedInitializers = containerExample === undefined
  ? initializerPackages
  : initializerPackages.filter(({ example }) => example === containerExample);
assert.ok(containerExample === undefined || selectedInitializers.length === 1, "invalid container example");

function registryDependencyVersions(lockfile) {
  const versions = new Set();
  for (const [location, dependency] of Object.entries(lockfile.packages)) {
    if (!location || !dependency.version) continue;
    const marker = "node_modules/";
    const markerIndex = location.lastIndexOf(marker);
    const name = markerIndex === -1 ? dependency.name : location.slice(markerIndex + marker.length);
    if (name && !name.startsWith("@emseepea/")) versions.add(`${name}@${dependency.version}`);
  }
  return versions;
}

function unrecordedRegistryDependencies(consumerLockfile, recordedLockfile) {
  const recordedVersions = registryDependencyVersions(recordedLockfile);
  return [...registryDependencyVersions(consumerLockfile)].filter((dependency) => !recordedVersions.has(dependency));
}

test("dependency graph comparison rejects unrecorded versions", () => {
  const recorded = { packages: { "node_modules/zod": { version: "4.4.3" } } };
  const consumer = { packages: {
    "node_modules/@emseepea/server": { version: "0.0.4" },
    "node_modules/zod": { version: "4.4.4" },
  } };
  assert.deepEqual(unrecordedRegistryDependencies(consumer, recorded), ["zod@4.4.4"]);
});

function run(command, args, cwd) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const timeout = command === "npm" && ["exec", "install"].includes(args[0]) ? 600_000 : 120_000;
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, env: environment });
  assert.equal(result.status, 0, [command, String(cwd), result.error?.code, result.signal, result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout;
}

function runAsync(command, args, cwd, timeoutOverride) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const timeout = timeoutOverride ?? (command === "npm" && ["exec", "install"].includes(args[0]) ? 600_000 : 120_000);
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

test("the packed public packages pass fresh-install and getting-started checks", { timeout: 900_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-packed-"));
  try {
    const tarballs = await Promise.all([
      packPackage("./packages/framework", directory),
      packPackage("./packages/feedback", directory),
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
    const [consumerLockfile, recordedLockfile] = await Promise.all([
      readFile(path.join(directory, "package-lock.json"), "utf8").then(JSON.parse),
      readFile(new URL("package-lock.json", root), "utf8").then(JSON.parse),
    ]);
    assert.deepEqual(
      unrecordedRegistryDependencies(consumerLockfile, recordedLockfile),
      [],
      "fresh install resolved a third-party dependency outside the committed repository lockfile",
    );

    await mkdir(path.join(directory, "routes"));
    await writeFile(
      path.join(directory, "routes/get.index.mjs"),
      'export default async (_request, reply) => { await reply.send("file route works"); };\n',
    );
    await writeFile(path.join(directory, "check.mjs"), `
      import { createEmseepea, defineTool, inputRequired, registerRoutes, serveEmseepea } from "@emseepea/server";
      import { defineFeedbackSubmission } from "@emseepea/feedback";
      import { startMcpServer } from "@emseepea/testing";
      import {
        assertNoToolCalls,
        assertOptionalToolCall,
        assertResponseContains,
        assertResponseMeaning,
        assertToolCalls,
        assertToolCallsWithOptionalFeedback,
        createConversation,
      } from "@emseepea/testing/semantic";
      import { z } from "zod";

      if (typeof startMcpServer !== "function" || typeof createConversation !== "function"
          || typeof assertToolCalls !== "function" || typeof assertNoToolCalls !== "function"
          || typeof assertOptionalToolCall !== "function"
          || typeof assertToolCallsWithOptionalFeedback !== "function"
          || typeof assertResponseContains !== "function"
          || typeof assertResponseMeaning !== "function") {
        throw new Error("packed testing package is missing its public helpers");
      }
      if (typeof defineFeedbackSubmission !== "function") {
        throw new Error("packed feedback package is missing its public constructor");
      }
      if ("sampleMessage" in inputRequired) {
        throw new Error("packed server unexpectedly exposes deprecated MCP Sampling");
      }
      const value = z.object({ value: z.string() });
      const tool = defineTool({
        name: "echo-value",
        access: "public",
        description: "Return one value.",
        inputSchema: value,
        outputSchema: value,
        handler: ({ value }) => ({ data: { value } }),
      });
      const app = createEmseepea({ name: "packed-check", version: "0.0.0", tools: [tool] });
      await registerRoutes(app, new URL("./routes/", import.meta.url));
      const running = await serveEmseepea(app, { port: 0 });
      try {
        const page = await fetch(new URL("/", running.url));
        if (!page.ok || await page.text() !== "file route works") throw new Error("packed route discovery failed");
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
        if (body.result?.content?.[0]?.text !== JSON.stringify(body.result.structuredContent)) {
          throw new Error("packed package did not return the structured result as JSON text");
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
    const installedReadme = await readFile(path.join(directory, "node_modules/@emseepea/server/README.md"), "utf8");
    assert.match(installedReadme, /intentionally does not support.*sampling\/createMessage/s);
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
      ["@emseepea/feedback", "./packages/feedback"],
      ["@emseepea/testing", "./packages/testing"],
      ["@emseepea/react", "./packages/react"],
      ["@emseepea/tailwind", "./packages/tailwind"],
      ...selectedInitializers.map(({ name, path: packagePath }) => [name, `./${packagePath}`]),
    ].map(async ([name, packagePath]) => [name, await packPackage(packagePath, directory)])));
    const fakeModel = path.join(directory, "fake-model.mjs");
    await cp(new URL("../fixtures/fake-semantic-model.mjs", import.meta.url), fakeModel);
    const expectedToolsByTurn = {
      "api-backed-server": [["search-pea-taxa"], []],
      "openapi-backed-server": [["get-pet"]],
      "database-schema-server": [["list-pea-varieties"], ["add-pea-variety"]],
      "html-ui-server": [["preview-planting-plan"], []],
      "mongodb-backed-server": [
        ["list-pea-varieties"],
        ["add-pea-variety"],
        ["record-pea-observation"],
        ["list-pea-observations"],
      ],
      "multi-instance-postgres-server": [["save-harvest-report"], ["get-harvest-report"]],
      "progress-streaming-server": [["run-germination-trial"], []],
      "react-ui-server": [["preview-planting-plan"], []],
      "soap-backed-server": [["get-pea-variety"]],
      "tool-server": [
        ["get-pea-variety"],
        ["get-pea-variety"],
        ["get-pea-variety"],
        [],
      ],
    };

    const queue = [...selectedInitializers];
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
      assert.equal(manifest.scripts["container:build"], "docker build --tag emseepea-server:local .");
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
      await writeFile(path.join(example, "src/feedback-composition.ts"), `
        import { defineFeedbackSubmission } from "@emseepea/feedback";
        import type { EmseepeaExtensions } from "@emseepea/server";

        const feedback = defineFeedbackSubmission({
          access: "public",
          scope: "standalone-example",
          backend: {
            submit: () => ({ id: "feedback-1", recordedAt: "2026-09-10T00:00:00.000Z" }),
          },
        });

        export const feedbackExtensions = {
          additionalTools: [feedback],
        } satisfies EmseepeaExtensions;
      `);
      await runAsync("npm", ["run", "lint"], example);
      await runAsync("npm", ["test"], example, 300_000);
      await runAsync("npm", [
        "run",
        "test:llm:built",
        "--",
        "--smoke",
        "--model-command",
        fakeModel,
        "--output",
        "artifacts/smoke.json",
      ], example);

      const evidence = JSON.parse(await readFile(path.join(example, "artifacts/smoke.json"), "utf8"));
      assert.equal(evidence.status, "passed", `${initializer.example} semantic smoke failed`);
      const results = Object.values(evidence.cases);
      if (initializer.example === "tool-server") {
        assert.equal(results.length, 3);
        const expectedCases = new Map([
          ["looks up pea varieties and compares a follow-up", {
            judges: 9, tools: [["get-pea-variety"], ["get-pea-variety"]],
          }],
          ["protected discovery offers a permitted tool", {
            judges: 9, tools: [["get-pea-variety"]],
          }],
          ["protected discovery does not offer a hidden tool", {
            judges: 9, tools: [[]],
          }],
        ]);
        for (const result of results) {
          const expected = expectedCases.get(result.name);
          assert.ok(expected, `unexpected tool-server case: ${result.name}`);
          assert.equal(result.answerTrials.length, 3);
          assert.equal(result.judgeVerdicts.length, expected.judges);
          for (const trial of result.answerTrials) {
            assert.deepEqual(
              trial.turns.map(({ selectedTools }) => selectedTools),
              expected.tools,
            );
            assert.ok(trial.turns.every((turn) => turn.expectedTools.length === 0
              || turn.expectedOptionalFeedback === true));
            assert.ok(trial.turns.every(({ expectedNegativeFeedback, negativeFeedbackCalls }) =>
              expectedNegativeFeedback === false && negativeFeedbackCalls.length === 0));
          }
        }
        return;
      }
      const [result] = results;
      assert.equal(result.answerTrials.length, 3);
      assert.equal(result.judgeVerdicts.length, initializer.example === "mongodb-backed-server" ? 18 : 9);
      assert.equal(result.mode, "conversation");
      for (const trial of result.answerTrials) {
        if (initializer.example === "resources-and-prompts-server") {
          assert.equal(trial.turns.length, 1);
          assert.equal(trial.turns[0].interactionMode, "native-mcp");
          assert.equal(trial.turns[0].expectedOptionalTool, "submit-feedback");
          assert.equal(trial.turns[0].advertisedToolCount, 1);
          assert.equal(trial.turns[0].toolCallCount, 0);
          assert.equal(trial.turns[0].pathEvidence.length, 0);
          continue;
        }
        const expectedTurns = expectedToolsByTurn[initializer.example];
        assert.ok(expectedTurns, `missing smoke expectations for ${initializer.example}`);
        assert.equal(trial.turns.length, expectedTurns.length);
        for (const [index, expectedTools] of expectedTurns.entries()) {
          assert.equal(trial.turns[index].interactionMode, "native-mcp");
          assert.deepEqual(trial.turns[index].expectedTools, expectedTools);
          assert.deepEqual(trial.turns[index].selectedTools, expectedTools);
          if (expectedTools.length > 0) assert.equal(trial.turns[index].expectedOptionalFeedback, true);
        }
        assert.ok(trial.turns.every(({ expectedNegativeFeedback, negativeFeedbackCalls }) =>
          expectedNegativeFeedback === false && negativeFeedbackCalls.length === 0));
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
    if (verifyContainers === "true") {
      const tarballMap = path.join(directory, "container-tarballs.json");
      await writeFile(tarballMap, JSON.stringify(Object.fromEntries(tarballs)));
      const verifier = fileURLToPath(new URL("../../scripts/verify-container-project.mjs", import.meta.url));
      for (const initializer of selectedInitializers) {
        await runAsync(process.execPath, [
          verifier,
          initializer.example,
          path.join(directory, initializer.key, "my-server"),
          tarballMap,
        ], root, 1_200_000);
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function packPackage(packagePath, directory) {
  const packed = Object.values(JSON.parse(run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    directory,
    packagePath,
  ], root)));
  assert.equal(packed.length, 1, `${packagePath} produced more than one tarball`);
  return path.join(directory, packed[0].filename);
}
