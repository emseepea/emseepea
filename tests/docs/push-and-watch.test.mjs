import assert from "node:assert/strict";
import test from "node:test";

import { pushAndWatch } from "../../scripts/push-and-watch.mjs";

test("push and watch binds both pipelines to the pushed commit", async () => {
  const sha = "a".repeat(40);
  const calls = [];
  let qualityPolls = 0;
  let releasePolls = 0;
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return "https://github.com/emseepea/emseepea.git";
    if (joined === "rev-parse HEAD") return sha;
    if (joined === "ls-remote origin refs/heads/main") return `${sha}\trefs/heads/main`;
    if (joined.includes("--workflow quality.yml")) {
      qualityPolls += 1;
      const secondAttempt = qualityPolls > 1 ? [{ attempt: 2, databaseId: 2, headSha: sha, url: "https://example.test/quality-2-rerun" }] : [];
      return JSON.stringify([
        { attempt: 1, databaseId: 2, headSha: sha, url: "https://example.test/quality-2" },
        { attempt: 1, databaseId: 1, headSha: sha, url: "https://example.test/quality-1" },
        { attempt: 1, databaseId: 9, headSha: "b".repeat(40), url: "https://example.test/stale" },
        ...secondAttempt,
      ]);
    }
    if (joined.includes("--workflow release.yml")) {
      releasePolls += 1;
      return releasePolls === 1 ? "[]" : JSON.stringify([
        { attempt: 1, databaseId: 3, headSha: sha, url: "https://example.test/release" },
      ]);
    }
    return "";
  };

  const result = await pushAndWatch({ run, pause: async () => {}, timeoutMs: 10_000 });
  assert.deepEqual(result, {
    sha,
    urls: ["https://example.test/quality-1", "https://example.test/quality-2", "https://example.test/quality-2-rerun", "https://example.test/release"],
  });
  assert.deepEqual(calls.filter(([command, subcommand]) => command === "git" && subcommand === "push"), [
    ["git", "push", "origin", `${sha}:refs/heads/main`],
  ]);
  assert.deepEqual(calls.filter(([command, first, second]) => command === "gh" && first === "run" && second === "watch"), [
    ["gh", "run", "watch", "1", "--repo", "emseepea/emseepea", "--exit-status"],
    ["gh", "run", "watch", "2", "--repo", "emseepea/emseepea", "--exit-status"],
    ["gh", "run", "watch", "2", "--repo", "emseepea/emseepea", "--exit-status"],
    ["gh", "run", "watch", "3", "--repo", "emseepea/emseepea", "--exit-status"],
  ]);
});

test("push and watch rejects the wrong remote revision", async () => {
  const sha = "a".repeat(40);
  const run = async (_command, args) => {
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return "https://github.com/emseepea/emseepea.git";
    if (joined === "rev-parse HEAD") return sha;
    if (joined === "ls-remote origin refs/heads/main") return `${"b".repeat(40)}\trefs/heads/main`;
    return "";
  };
  await assert.rejects(() => pushAndWatch({ run }), /origin\/main does not match/);
});

test("push and watch rejects invalid identity before pushing", async () => {
  for (const [origin, sha, message] of [
    ["https://github.com/someone/else.git", "a".repeat(40), /regular expression/],
    ["https://github.com/emseepea/emseepea.git", "not-a-sha", /regular expression/],
  ]) {
    const calls = [];
    const run = async (command, args) => {
      calls.push([command, ...args]);
      return args[0] === "remote" ? origin : sha;
    };
    await assert.rejects(() => pushAndWatch({ run }), message);
    assert.equal(calls.some(([command, operation]) => command === "git" && operation === "push"), false);
  }
});

test("push and watch fails when an exact workflow run does not appear", async () => {
  const sha = "a".repeat(40);
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return "https://github.com/emseepea/emseepea.git";
    if (joined === "rev-parse HEAD") return sha;
    if (joined === "ls-remote origin refs/heads/main") return `${sha}\trefs/heads/main`;
    if (joined.startsWith("run list")) return "[]";
    return "";
  };
  await assert.rejects(() => pushAndWatch({ run, timeoutMs: -1 }), /quality\.yml did not start/);
  assert.equal(calls.some(([command, first, second]) => command === "gh" && first === "run" && second === "watch"), false);
});

test("push and watch propagates a failed pipeline", async () => {
  const sha = "a".repeat(40);
  const run = async (command, args) => {
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return "git@github.com:emseepea/emseepea.git";
    if (joined === "rev-parse HEAD") return sha;
    if (joined === "ls-remote origin refs/heads/main") return `${sha}\trefs/heads/main`;
    if (joined.startsWith("run list")) return JSON.stringify([
      { attempt: 1, databaseId: 1, headSha: sha, url: "https://example.test/quality" },
    ]);
    if (command === "gh" && joined.startsWith("run watch")) throw new Error("workflow failed");
    return "";
  };
  await assert.rejects(() => pushAndWatch({ run }), /workflow failed/);
});

test("push and watch rejects a truncated workflow result set", async () => {
  const sha = "a".repeat(40);
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return "https://github.com/emseepea/emseepea.git";
    if (joined === "rev-parse HEAD") return sha;
    if (joined === "ls-remote origin refs/heads/main") return `${sha}\trefs/heads/main`;
    if (joined.startsWith("run list")) return JSON.stringify(Array.from({ length: 100 }, (_, databaseId) => ({
      attempt: 1, databaseId, headSha: sha, url: `https://example.test/${databaseId}`,
    })));
    return "";
  };
  await assert.rejects(() => pushAndWatch({ run }), /run list reached its safety limit/);
  assert.equal(calls.some(([command, first, second]) => command === "gh" && first === "run" && second === "watch"), false);
});
