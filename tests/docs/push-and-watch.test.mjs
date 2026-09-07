import assert from "node:assert/strict";
import test from "node:test";

import { pushAndWatch, watchWorkflowRuns } from "../../scripts/push-and-watch.mjs";

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
      return releasePolls === 1 ? JSON.stringify([
        { attempt: 1, conclusion: "skipped", databaseId: 4, headSha: sha, url: "https://example.test/skipped" },
      ]) : JSON.stringify([
        { attempt: 1, databaseId: 3, headSha: sha, url: "https://example.test/release" },
      ]);
    }
    if (joined.startsWith("run view")) return JSON.stringify({ status: "completed", conclusion: "success" });
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
  assert.equal(calls.some(([command, first, second]) => command === "gh" && first === "run" && second === "watch"), false);
  assert.equal(calls.filter(([command, first, second]) => command === "gh" && first === "run" && second === "view").length, 4);
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
  for (const conclusion of ["failure", "cancelled"]) {
    const sha = "a".repeat(40);
    const run = async (_command, args) => args[1] === "list"
      ? JSON.stringify([{ attempt: 1, databaseId: 1, headSha: sha, url: "https://example.test/quality" }])
      : JSON.stringify({ status: "completed", conclusion });
    await assert.rejects(
      () => watchWorkflowRuns({ sha, run }),
      new RegExp(`quality\\.yml concluded ${conclusion}`),
    );
  }
});

test("push and watch survives transient GitHub read failures", async () => {
  const sha = "a".repeat(40);
  const listAttempts = { "quality.yml": 0, "release.yml": 0 };
  const viewAttempts = { 1: 0, 2: 0 };
  const run = async (_command, args) => {
    const joined = args.join(" ");
    if (joined.startsWith("run list")) {
      const workflow = args[args.indexOf("--workflow") + 1];
      listAttempts[workflow] += 1;
      if (listAttempts[workflow] === 1) throw new Error("connection reset");
      const databaseId = workflow === "quality.yml" ? 1 : 2;
      return JSON.stringify([{ attempt: 1, databaseId, headSha: sha, url: `https://example.test/${databaseId}` }]);
    }
    const databaseId = Number(args[2]);
    viewAttempts[databaseId] += 1;
    if (viewAttempts[databaseId] === 1) throw new Error("connection reset");
    return JSON.stringify({ status: viewAttempts[databaseId] === 2 ? "in_progress" : "completed", conclusion: viewAttempts[databaseId] === 2 ? "" : "success" });
  };
  assert.deepEqual(
    await watchWorkflowRuns({ sha, run, pause: async () => {}, timeoutMs: 10_000 }),
    ["https://example.test/1", "https://example.test/2"],
  );
  assert.deepEqual(listAttempts, { "quality.yml": 3, "release.yml": 3 });
  assert.deepEqual(viewAttempts, { 1: 3, 2: 3 });
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
