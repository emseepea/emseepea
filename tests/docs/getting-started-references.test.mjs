import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const guidePath = path.join(root, "website/src/content/docs/getting-started.md");
const guide = await readFile(guidePath, "utf8");
const example = "basic-no-ui";
const manifest = JSON.parse(await readFile(path.join(root, `examples/${example}/package.json`), "utf8"));
const exec = promisify(execFile);

test("the quickstart references the initializer's scripts, packages and guide links", async () => {
  assert.ok(guide.includes(`example: ${example}`));
  for (const name of ["@emseepea/server", "@emseepea/testing"]) {
    assert.ok(guide.includes(`\`${name}\``));
  }
  const commands = [...guide.matchAll(/```(?:sh|bash)(?: [^\n]*)?\n([\s\S]*?)```/g)]
    .flatMap(([, block]) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  assert.ok(commands.length > 0);

  for (const command of commands) {
    if (["npm init @emseepea/tool-server@next -- my-mcp", "cd my-mcp", "npm install --ignore-scripts"].includes(command)) continue;
    if (command === "npm test" || command === "npm start") {
      assert.ok(manifest.scripts[command.split(" ")[1]], `missing example script: ${command}`);
      continue;
    }
    const script = command.match(/^npm run ([a-z0-9:-]+)$/)?.[1];
    assert.ok(script, `unknown documented command: ${command}`);
    assert.ok(manifest.scripts[script], `missing example script: ${script}`);
  }

  const links = [...guide.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map(([, target]) => target)
    .filter((target) => !/^(?:https?:|mailto:|#)/.test(target));
  assert.ok(links.length > 0);

  for (const link of links) {
    const route = new URL(link, "https://docs.invalid/getting-started/").pathname.replace(/\/$/, "");
    const target = path.join(root, "website/src/content/docs", `${route}.md`);
    const relative = path.relative(root, target);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `unsafe local link: ${link}`);
    await access(target);
  }
});

test("the initialized quickstart passes its documented checks", { timeout: 900_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-website-guide-"));
  try {
    const packageSource = process.env.EMSEEPEA_GUIDE_PACKAGE_SOURCE ?? "packed";
    assert.ok(["packed", "registry"].includes(packageSource), `unknown package source: ${packageSource}`);
    if (packageSource === "packed") {
      const initializer = await packPackage("examples/basic-no-ui", directory);
      await exec("npm", ["exec", "--yes", "--offline", "--userconfig", "/dev/null", "--package", initializer, "--", "create-tool-server", "my-mcp"], {
        cwd: directory, timeout: 600_000, maxBuffer: 1024 * 1024,
      });
    } else {
      await exec("npm", ["init", "@emseepea/tool-server@next", "--", "my-mcp"], {
        cwd: directory, env: { ...process.env, npm_config_yes: "true" }, timeout: 600_000, maxBuffer: 1024 * 1024,
      });
    }
    const project = path.join(directory, "my-mcp");
    if (packageSource === "packed") {
      const generatedManifest = JSON.parse(await readFile(path.join(project, "package.json"), "utf8"));
      generatedManifest.dependencies["@emseepea/server"] = `file:${await packPackage("packages/framework", directory)}`;
      generatedManifest.devDependencies["@emseepea/testing"] = `file:${await packPackage("packages/testing", directory)}`;
      await writeFile(path.join(project, "package.json"), `${JSON.stringify(generatedManifest, null, 2)}\n`);
    }
    const block = guide.match(/```sh title="Install and check"\n([\s\S]*?)```/)?.[1];
    assert.ok(block, "the executable install-and-check block is required");
    const commands = block.trim().split("\n");
    assert.deepEqual(commands, ["npm install --ignore-scripts", "npm test", "npm run lint"]);
    const env = {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_prefer_offline: "true",
      npm_config_registry: "https://registry.npmjs.org",
      npm_config_userconfig: "/dev/null",
    };
    delete env.NODE_TEST_CONTEXT;
    for (const command of commands) {
      const [binary, ...args] = command.split(" ");
      const timeout = command === "npm install --ignore-scripts" ? 600_000 : 120_000;
      await exec(binary, args, { cwd: project, env, timeout, maxBuffer: 1024 * 1024 });
    }
    for (const name of ["@emseepea/server", "@emseepea/testing"]) {
      const installed = JSON.parse(await readFile(path.join(project, "node_modules", name, "package.json"), "utf8"));
      assert.equal(installed.version, manifest.dependencies?.[name] ?? manifest.devDependencies?.[name]);
    }

    // Exercise the documented command, not a direct launch that bypasses its script.
    const child = spawn("npm", ["start"], {
      cwd: project, env: { ...env, PORT: "0" }, detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    let launchError;
    child.on("error", (error) => { launchError = error; });
    child.stderr.on("data", (chunk) => { errors = `${errors}${chunk}`.slice(-16_384); });
    const closed = new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
    let client;
    let startupTimer;
    let shutdownTimer;
    try {
      const url = await new Promise((resolve, reject) => {
        startupTimer = setTimeout(() => reject(new Error(`npm start timed out: ${errors}`)), 15_000);
        child.stdout.on("data", (chunk) => {
          output = `${output}${chunk}`.slice(-16_384);
          const address = output.match(/http:\/\/127\.0\.0\.1:\d+\/mcp/)?.[0];
          if (address) resolve(new URL(address));
        });
        closed.then(() => reject(launchError ?? new Error(`npm start exited before readiness: ${errors}`)));
      }).finally(() => clearTimeout(startupTimer));
      assert.notEqual(url.port, "0", "the example must print its listening port");
      const { Client, StreamableHTTPClientTransport } = createRequire(path.join(project, "package.json"))("@modelcontextprotocol/client");
      client = new Client({ name: "website-quickstart", version: "0.0.0" }, {
        versionNegotiation: { mode: { pin: "2026-07-28" } },
      });
      await client.connect(new StreamableHTTPClientTransport(url), { timeout: 5_000 });
      const result = await client.callTool({
        name: "get-bean-details", arguments: { name: "Highland Bloom" },
      }, { timeout: 5_000 });
      assert.equal(result.isError, false);
      assert.deepEqual(result.structuredContent, {
        name: "Highland Bloom", origin: "Sample Highlands", variety: "Bourbon",
        process: "natural", roast: "medium", tastingNotes: ["berry", "cocoa"],
      });
      await client.close();
      client = undefined;
      // Ctrl-C reaches the whole terminal process group, including npm's child.
      process.kill(-child.pid, "SIGINT");
      const exit = await Promise.race([
        closed,
        new Promise((_, reject) => {
          shutdownTimer = setTimeout(() => reject(new Error("npm start did not stop after Ctrl-C")), 5_000);
        }),
      ]).finally(() => clearTimeout(shutdownTimer));
      assert.ok(exit.code === 0 || exit.code === 130 || exit.signal === "SIGINT", JSON.stringify(exit));
      await assert.rejects(fetch(url, { signal: AbortSignal.timeout(1_000) }),
        (error) => error.cause?.code === "ECONNREFUSED", "Ctrl-C must close the listening socket");
    } finally {
      clearTimeout(startupTimer);
      clearTimeout(shutdownTimer);
      // Only this test's detached group; forced cleanup never turns a failure into a pass.
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch (error) { if (error.code !== "ESRCH") throw error; }
      }
      await client?.close();
      await closed;
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function packPackage(packagePath, directory) {
  const { stdout } = await exec("npm", [
    "pack", "--json", "--ignore-scripts", "--pack-destination", directory, path.join(root, packagePath),
  ], { cwd: root, timeout: 120_000, maxBuffer: 1024 * 1024 });
  return path.join(directory, JSON.parse(stdout)[0].filename);
}
