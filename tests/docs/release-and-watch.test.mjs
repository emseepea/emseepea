import assert from "node:assert/strict";
import test from "node:test";

import { releaseAndWatch } from "../../scripts/release-and-watch.mjs";

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const mergeSha = "c".repeat(40);
const pullRequest = {
  number: 25,
  baseRefOid: baseSha,
  headRefOid: headSha,
  url: "https://example.test/pull/25",
};

test("release and watch binds the Changesets PR and both pipelines to exact commits", async () => {
  const calls = [];
  let releasePolls = 0;
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return "https://github.com/emseepea/emseepea.git";
    if (joined === "status --porcelain") return "";
    if (joined === "branch --show-current") return "main";
    if (joined === "rev-parse HEAD") return baseSha;
    if (joined.startsWith("pr list")) return JSON.stringify([pullRequest]);
    if (joined.startsWith("pr view")) {
      return JSON.stringify({ state: "MERGED", mergeCommit: { oid: mergeSha }, url: pullRequest.url });
    }
    if (joined.includes("--workflow quality.yml")) {
      return JSON.stringify([{ attempt: 1, databaseId: 10, headSha: mergeSha, url: "https://example.test/quality" }]);
    }
    if (joined.includes("--workflow release.yml")) {
      releasePolls += 1;
      return releasePolls === 1 ? "[]" : JSON.stringify([
        { attempt: 1, databaseId: 11, headSha: mergeSha, url: "https://example.test/release" },
      ]);
    }
    return "";
  };

  assert.deepEqual(await releaseAndWatch({ run, pause: async () => {}, timeoutMs: 10_000 }), {
    pullRequest: pullRequest.url,
    sha: mergeSha,
    urls: ["https://example.test/quality", "https://example.test/release"],
  });
  assert.deepEqual(calls.find(([command, first, second]) => command === "gh" && first === "pr" && second === "list"), [
    "gh", "pr", "list", "--repo", "emseepea/emseepea", "--state", "open", "--base", "main",
    "--head", "changeset-release/main", "--limit", "2", "--json", "number,headRefOid,baseRefOid,url",
  ]);
  assert.deepEqual(calls.find(([command, first, second]) => command === "gh" && first === "pr" && second === "merge"), [
    "gh", "pr", "merge", "25", "--repo", "emseepea/emseepea", "--merge", "--match-head-commit", headSha,
  ]);
  assert.deepEqual(calls.filter(([command, first, second]) => command === "gh" && first === "run" && second === "watch"), [
    ["gh", "run", "watch", "10", "--repo", "emseepea/emseepea", "--exit-status"],
    ["gh", "run", "watch", "11", "--repo", "emseepea/emseepea", "--exit-status"],
  ]);
});

test("release and watch rejects unsafe checkout or pull request state before merging", async () => {
  for (const [override, message] of [
    [{ remote: "https://github.com/someone/else.git" }, /regular expression/],
    [{ status: " M package.json" }, /not clean/],
    [{ branch: "feature" }, /not on main/],
    [{ pullRequests: [] }, /exactly one/],
    [{ pullRequests: [pullRequest, { ...pullRequest, number: 26 }] }, /exactly one/],
    [{ pullRequests: [{ ...pullRequest, baseRefOid: "d".repeat(40) }] }, /does not match/],
  ]) {
    const calls = [];
    const run = checkoutRun(override, calls);
    await assert.rejects(() => releaseAndWatch({ run }), message);
    assert.equal(calls.some(([command, first, second]) => command === "gh" && first === "pr" && second === "merge"), false);
  }
});

test("release and watch fails when an exact workflow run does not appear", async () => {
  const run = checkoutRun({ workflowRuns: "[]" });
  await assert.rejects(
    () => releaseAndWatch({ run, timeoutMs: -1 }),
    /quality\.yml did not start/,
  );
});

test("release and watch propagates a failed exact-commit pipeline", async () => {
  const run = checkoutRun({
    workflowRuns: JSON.stringify([
      { attempt: 1, databaseId: 10, headSha: mergeSha, url: "https://example.test/quality" },
    ]),
    watchError: new Error("workflow failed"),
  });
  await assert.rejects(() => releaseAndWatch({ run }), /workflow failed/);
});

test("release and watch times out after an exact workflow run starts", async () => {
  const run = checkoutRun({
    workflowRuns: JSON.stringify([
      { attempt: 1, databaseId: 10, headSha: mergeSha, url: "https://example.test/quality" },
    ]),
  });
  await assert.rejects(() => releaseAndWatch({ run, timeoutMs: -1 }), /did not finish within the timeout/);
});

function checkoutRun(overrides = {}, calls = []) {
  return async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined === "remote get-url origin") return overrides.remote ?? "https://github.com/emseepea/emseepea.git";
    if (joined === "status --porcelain") return overrides.status ?? "";
    if (joined === "branch --show-current") return overrides.branch ?? "main";
    if (joined === "rev-parse HEAD") return baseSha;
    if (joined.startsWith("pr list")) return JSON.stringify(overrides.pullRequests ?? [pullRequest]);
    if (joined.startsWith("pr view")) {
      return JSON.stringify({ state: "MERGED", mergeCommit: { oid: mergeSha }, url: pullRequest.url });
    }
    if (joined.startsWith("run list")) return overrides.workflowRuns ?? "[]";
    if (joined.startsWith("run watch") && overrides.watchError) throw overrides.watchError;
    return "";
  };
}
