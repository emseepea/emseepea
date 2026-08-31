import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
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

test("the quickstart references the copied example's scripts, packages and guide links", async () => {
  assert.ok(guide.includes(`example: ${example}`));
  for (const name of ["@emseepea/server", "@emseepea/testing"]) {
    const version = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    assert.ok(guide.includes(`\`${name}\``));
    assert.ok(guide.includes(version), `documented ${name} version must match the example`);
  }
  const commands = [...guide.matchAll(/```(?:sh|bash)(?: [^\n]*)?\n([\s\S]*?)```/g)]
    .flatMap(([, block]) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  assert.ok(commands.length > 0);

  for (const command of commands) {
    if (["git clone https://github.com/windyroad/emseepea.git", `cp -R emseepea/examples/${example} my-mcp`, "cd my-mcp", "npm install --ignore-scripts"].includes(command)) continue;
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

test("the copied quickstart passes its documented checks with exact public npm packages", { timeout: 180_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-website-guide-"));
  try {
    await cp(path.join(root, `examples/${example}`), directory, {
      recursive: true,
      filter: (source) => !/(^|\/)(node_modules|dist|artifacts)$/.test(source),
    });
    const block = guide.match(/```sh title="Install and check"\n([\s\S]*?)```/)?.[1];
    assert.ok(block, "the executable install-and-check block is required");
    const commands = block.trim().split("\n");
    assert.deepEqual(commands, ["npm install --ignore-scripts", "npm test", "npm run lint"]);
    const env = { ...process.env, npm_config_userconfig: "/dev/null", npm_config_registry: "https://registry.npmjs.org" };
    delete env.NODE_TEST_CONTEXT;
    for (const command of commands) {
      const [binary, ...args] = command.split(" ");
      await exec(binary, args, { cwd: directory, env, timeout: 120_000, maxBuffer: 1024 * 1024 });
    }
    for (const name of ["@emseepea/server", "@emseepea/testing"]) {
      const installed = JSON.parse(await readFile(path.join(directory, "node_modules", name, "package.json"), "utf8"));
      assert.equal(installed.version, manifest.dependencies?.[name] ?? manifest.devDependencies?.[name]);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
