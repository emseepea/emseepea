import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const workflow = parse(await readFile(new URL("../../.github/workflows/publish.yml", import.meta.url), "utf8"));

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

test("release records finish before the publish head reaches main", () => {
  assert.deepEqual(workflow.jobs["release-records"].needs, ["promote"]);
  assert.deepEqual(workflow.jobs["merge-back"].needs, ["promote", "deploy-website", "release-records"]);
});
