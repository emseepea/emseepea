import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the documented proxy progress configuration constructs a server", async () => {
  const readme = await readFile(new URL("../../packages/framework/README.md", import.meta.url), "utf8");
  const section = readme.split("## Streaming Progress\n")[1]?.split("\n## Public Resources and Prompts")[0];
  assert.ok(section, "missing streaming guide");
  const snippets = [...section.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1]);
  assert.equal(snippets.length, 2, "expected the tool definition and proxy configuration");
  const result = spawnSync(process.execPath, ["--input-type=module"], {
    cwd: new URL("../../", import.meta.url),
    input: `${snippets.join("\n")}\ntry { await app.ready(); } finally { await app.close(); }`,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
