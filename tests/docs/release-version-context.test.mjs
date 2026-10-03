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
      if (args[0] === "diff") return "packages/server/package.json\n";
      if (args[0] === "show") return JSON.stringify({
        name: "@emseepea/server", version: args[1].startsWith(baseSha) ? "0.18.1" : "0.19.0",
      });
      return "";
    },
  });
  assert.deepEqual(result.changedPackages, new Set(["@emseepea/server"]));
  assert.deepEqual(calls[0], ["git", "merge-base", "--is-ancestor", baseSha, releaseSha]);
  assert.deepEqual(calls[1], ["git", "diff", "--name-only", baseSha, releaseSha, "--", "packages/server/package.json", "packages/tailwind/package.json"]);
});

test("development dependency changes do not classify an unchanged version as fresh", async () => {
  const result = await releaseVersionContext({
    releaseSha: "b".repeat(40),
    read: async () => JSON.stringify({ sha: "a".repeat(40) }),
    packages: [{ name: "@emseepea/feedback", path: "packages/feedback" }],
    run: async (_command, args) => {
      if (args[0] === "diff") return "packages/feedback/package.json\n";
      if (args[0] === "show") return JSON.stringify({
        name: "@emseepea/feedback", version: "0.5.1",
        devDependencies: { "@emseepea/testing": args[1].startsWith("a") ? "0.17.1" : "0.18.0" },
      });
      return "";
    },
  });
  assert.deepEqual(result.changedPackages, new Set());
});

test("unchanged manifests need no version read", async () => {
  const result = await releaseVersionContext({
    releaseSha: "b".repeat(40),
    read: async () => JSON.stringify({ sha: "a".repeat(40) }),
    packages: [{ name: "@emseepea/server", path: "packages/server" }],
    run: async (_command, args) => {
      assert.notEqual(args[0], "show");
      return "";
    },
  });
  assert.deepEqual(result.changedPackages, new Set());
});

for (const [label, manifest, message] of [
  ["malformed JSON", "{", /JSON/],
  ["wrong name", JSON.stringify({ name: "other", version: "1.0.0" }), /name does not match/],
  ["missing version", JSON.stringify({ name: "@emseepea/server" }), /version is missing/],
  ["invalid version", JSON.stringify({ name: "@emseepea/server", version: "broken" }), /version is invalid/],
]) {
  test(`fails closed for ${label}`, async () => {
    await assert.rejects(() => releaseVersionContext({
      releaseSha: "b".repeat(40),
      read: async () => JSON.stringify({ sha: "a".repeat(40) }),
      packages: [{ name: "@emseepea/server", path: "packages/server" }],
      run: async (_command, args) => args[0] === "diff" ? "packages/server/package.json\n" : args[0] === "show" ? manifest : "",
    }), message);
  });
}

test("failed pinned manifest reads are not ignored", async () => {
  await assert.rejects(() => releaseVersionContext({
    releaseSha: "b".repeat(40),
    read: async () => JSON.stringify({ sha: "a".repeat(40) }),
    packages: [{ name: "@emseepea/server", path: "packages/server" }],
    run: async (_command, args) => {
      if (args[0] === "diff") return "packages/server/package.json\n";
      if (args[0] === "show") throw new Error("manifest read failed");
      return "";
    },
  }), /manifest read failed/);
});

test("an unrelated release head cannot provide the classification", async () => {
  await assert.rejects(() => releaseVersionContext({
    releaseSha: "b".repeat(40),
    read: async () => JSON.stringify({ sha: "a".repeat(40) }),
    packages: [{ name: "@emseepea/server", path: "packages/server" }],
    run: async () => { throw new Error("not an ancestor"); },
  }), /not an ancestor/);
});
