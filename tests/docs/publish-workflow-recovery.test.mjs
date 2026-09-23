import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const workflow = parse(await readFile(new URL("../../.github/workflows/publish.yml", import.meta.url), "utf8"));
const quality = parse(await readFile(new URL("../../.github/workflows/quality.yml", import.meta.url), "utf8"));

test("release pull requests use the exact-head release build instead of duplicate Quality runs", () => {
  assert.deepEqual(quality.on.pull_request["branches-ignore"], ["publish"]);
});

test("a new release pull request waits for the previous publish head to reach main", () => {
  const guard = quality.jobs["release-pull-request"].steps.find((step) =>
    step.name === "Require the previous publish head on main");
  const main = "a".repeat(40);
  const shell = `
    git() {
      case "$1" in
        ls-remote|fetch) return 0 ;;
        merge-base) [ "$PUBLISH_IS_ANCESTOR" = true ] && return 0 || return 1 ;;
      esac
      return 1
    }
    ${guard?.run ?? "missing_guard"}
  `;
  const env = { ...process.env, GITHUB_SHA: main, PUBLISH_IS_ANCESTOR: "true" };
  const accepted = spawnSync("bash", ["-e", "-c", shell], { env, encoding: "utf8" });
  assert.equal(accepted.status, 0, accepted.stderr);

  const refused = spawnSync("bash", ["-e", "-c", shell], {
    env: { ...env, PUBLISH_IS_ANCESTOR: "false" },
    encoding: "utf8",
  });
  assert.notEqual(refused.status, 0);
});

test("release dispatch runs for the matching PR head and refuses a mismatch", () => {
  const dispatch = quality.jobs["release-pull-request"].steps.find((step) =>
    step.name === "Build and publish the release pull request under next");
  const head = "a".repeat(40);
  const shell = `
    git() { printf '%s\\trefs/heads/changeset-release/publish\\n' "$HEAD_SHA"; }
    gh() { if [ "$1" = pr ]; then printf '%s\\n' "$PR_SHA"; else printf 'DISPATCH:%s\\n' "$*"; fi; }
    ${dispatch.run}
  `;
  const env = { ...process.env, HEAD_SHA: head, PR_SHA: head, GITHUB_REPOSITORY: "emseepea/emseepea", GITHUB_SHA: "b".repeat(40), GITHUB_RUN_ID: "123" };
  const accepted = spawnSync("bash", ["-e", "-c", shell], { env, encoding: "utf8" });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, new RegExp(`DISPATCH:workflow run release\\.yml .*head_sha=${head}`));

  const refused = spawnSync("bash", ["-e", "-c", shell], { env: { ...env, PR_SHA: "c".repeat(40) }, encoding: "utf8" });
  assert.notEqual(refused.status, 0);
  assert.doesNotMatch(refused.stdout, /DISPATCH:/);
});

test("promotion passes the bound release run to the original artifact download", () => {
  const promote = workflow.jobs.promote;
  const bind = promote.steps.find((step) => step.name === "Bind promotion to the checked release run");
  const download = workflow.jobs["release-records"].steps.find((step) => step.uses?.startsWith("actions/download-artifact@"));
  assert.equal(bind.id, "bind");
  assert.match(bind.run, /GITHUB_OUTPUT/);
  assert.equal(promote.outputs.release_sha, "${{ steps.bind.outputs.EMSEEPEA_RELEASE_SHA }}");
  assert.equal(promote.outputs.release_run_id, "${{ steps.bind.outputs.EMSEEPEA_RELEASE_RUN_ID }}");
  assert.equal(download.with.name, "release-artifacts-${{ needs.promote.outputs.release_sha }}");
  assert.equal(download.with["run-id"], "${{ needs.promote.outputs.release_run_id }}");
  assert.equal(workflow.jobs["release-records"].permissions.actions, "read");
});

test("a failed promotion bind cannot pass through tee", () => {
  const bind = workflow.jobs.promote.steps.find((step) => step.name === "Bind promotion to the checked release run");
  const result = spawnSync("bash", ["-e", "-c", `node() { return 7; }\n${bind.run}`], {
    env: { ...process.env, GITHUB_ENV: "/dev/null", GITHUB_OUTPUT: "/dev/null" },
    encoding: "utf8",
  });
  assert.equal(result.status, 7);
});

test("release records finish before the publish head reaches main", () => {
  assert.deepEqual(workflow.jobs["release-records"].needs, ["promote"]);
  assert.deepEqual(workflow.jobs["merge-back"].needs, ["promote", "deploy-website", "release-records"]);
});
