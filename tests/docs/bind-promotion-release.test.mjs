import assert from "node:assert/strict";
import test from "node:test";

import { bindPromotionRelease } from "../../scripts/bind-promotion-release.mjs";

const sourceSha = "a".repeat(40);
const releaseSha = "b".repeat(40);
const originalMerge = "c".repeat(40);
const repairHead = "d".repeat(40);
const repairMerge = "e".repeat(40);
const successful = (sha = releaseSha, id = 123) => ({
  id, head_sha: sha, head_branch: "changeset-release/publish",
  event: "workflow_dispatch", conclusion: "success",
});

function fixture({ repair = false, runs = [successful()], origin = sourceSha, diff, website = "0.1.0", expectedRepairBase = originalMerge, defaultLookup = false, unrelated = false } = {}) {
  const head = repair ? repairMerge : originalMerge;
  const outputs = {
    "rev-parse HEAD": head,
    "rev-parse HEAD^2": repair ? repairHead : releaseSha,
    "rev-parse HEAD^1": originalMerge,
    "rev-parse HEAD^1^2": releaseSha,
    ["show HEAD:.release/origin.json"]: JSON.stringify({ sha: origin }),
    ["show " + releaseSha + ":.release/origin.json"]: JSON.stringify({ sha: sourceSha }),
    ["show " + sourceSha + ":website/package.json"]: JSON.stringify({ version: "0.1.0" }),
    ["show " + releaseSha + ":website/package.json"]: JSON.stringify({ version: website }),
    ["diff --name-only " + releaseSha + " " + head]: diff ?? (repair
      ? ".github/workflows/publish.yml\nscripts/promote-release.mjs\nscripts/bind-promotion-release.mjs\ntests/docs/promote-release.test.mjs\ntests/docs/bind-promotion-release.test.mjs"
      : ""),
    ["diff --name-only " + releaseSha + " " + originalMerge]: "",
  };
  const options = {
    env: { GITHUB_SHA: head, GITHUB_REPOSITORY: "emseepea/emseepea", EMSEEPEA_REPAIR_BASE_SHA: expectedRepairBase },
    run: async (command, args) => {
      if (command === "gh") {
        assert.equal(args[3], "repos/emseepea/emseepea/actions/workflows/release.yml/runs");
        const requested = args.find((item) => item.startsWith("head_sha=")).slice("head_sha=".length);
        return JSON.stringify({ workflow_runs: requested === releaseSha ? runs : [] });
      }
      assert.equal(command, "git");
      if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
        if (unrelated) throw new Error("not an ancestor");
        return "";
      }
      const key = args.join(" ");
      assert.ok(Object.hasOwn(outputs, key), `unexpected git command: ${key}`);
      return outputs[key];
    },
  };
  if (!defaultLookup) options.listRuns = async (sha) => sha === releaseSha ? runs : [];
  return options;
}

test("normal publish binds the merge second parent to its successful Release run", async () => {
  assert.deepEqual(await bindPromotionRelease(fixture()), { releaseSha, releaseRunId: "123" });
});

test("a promotion-only repair binds the original merge second parent, not the repair head", async () => {
  assert.deepEqual(await bindPromotionRelease(fixture({ repair: true })), { releaseSha, releaseRunId: "123" });
});

test("the production GitHub lookup uses the supplied repository and original run", async () => {
  assert.deepEqual(await bindPromotionRelease(fixture({ repair: true, defaultLookup: true })), { releaseSha, releaseRunId: "123" });
});

test("repair refuses a changed first parent, disallowed source edit, or website release", async () => {
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, expectedRepairBase: "f".repeat(40) })), /original publish merge/);
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, diff: "packages/framework/src/index.ts" })), /promotion-only/);
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, website: "0.2.0" })), /website/);
});

test("repair refuses missing, ambiguous, wrong-head, or wrong-origin Release evidence", async () => {
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, runs: [] })), /successful Release run/);
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, runs: [successful(), successful(releaseSha, 124)] })), /successful Release run/);
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, runs: [successful(repairHead)] })), /successful Release run/);
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, origin: "f".repeat(40) })), /release source/);
  await assert.rejects(() => bindPromotionRelease(fixture({ repair: true, unrelated: true })), /not an ancestor/);
});
