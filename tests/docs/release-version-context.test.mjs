import assert from "node:assert/strict";
import test from "node:test";

import { releaseVersionContext } from "../../scripts/release-version-context.mjs";

test("fresh packages are classified from the immutable source-to-release manifest diff", async () => {
  const baseSha = "a".repeat(40);
  const releaseSha = "b".repeat(40);
  const calls = [];
  const result = await releaseVersionContext({
    releaseSha,
    read: async () => JSON.stringify({ sha: baseSha }),
    packages: [
      { name: "@emseepea/server", path: "packages/server" },
      { name: "@emseepea/tailwind", path: "packages/tailwind" },
    ],
    run: async (command, args) => {
      calls.push([command, ...args]);
      return args[0] === "diff" ? "packages/server/package.json\n" : "";
    },
  });
  assert.deepEqual(result.changedPackages, new Set(["@emseepea/server"]));
  assert.deepEqual(calls[0], ["git", "merge-base", "--is-ancestor", baseSha, releaseSha]);
  assert.deepEqual(calls[1], ["git", "diff", "--name-only", baseSha, releaseSha, "--", "packages/server/package.json", "packages/tailwind/package.json"]);
});

test("an unrelated release head cannot provide the classification", async () => {
  await assert.rejects(() => releaseVersionContext({
    releaseSha: "b".repeat(40),
    read: async () => JSON.stringify({ sha: "a".repeat(40) }),
    packages: [{ name: "@emseepea/server", path: "packages/server" }],
    run: async () => { throw new Error("not an ancestor"); },
  }), /not an ancestor/);
});
