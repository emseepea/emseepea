import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const guidePath = path.join(root, "docs/guides/getting-started.md");
const guide = await readFile(guidePath, "utf8");
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

test("the source guide references current scripts and local files", async () => {
  const commands = [...guide.matchAll(/```(?:sh|bash)\n([\s\S]*?)```/g)]
    .flatMap(([, block]) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  assert.ok(commands.length > 0);

  for (const command of commands) {
    if (command === "npm ci --ignore-scripts") continue;
    if (command === "npm test") {
      assert.ok(manifest.scripts.test, "missing root script: test");
      continue;
    }
    const script = command.match(/^npm run ([a-z0-9:-]+)$/)?.[1];
    assert.ok(script, `unknown documented command: ${command}`);
    assert.ok(manifest.scripts[script], `missing root script: ${script}`);
  }

  const links = [...guide.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map(([, target]) => target)
    .filter((target) => !/^(?:https?:|mailto:|#)/.test(target));
  assert.ok(links.length > 0);

  for (const link of links) {
    const target = path.resolve(path.dirname(guidePath), link.split("#", 1)[0]);
    const relative = path.relative(root, target);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `unsafe local link: ${link}`);
    await access(target);
  }
});
