import { applyReleasePlan } from "@changesets/apply-release-plan";
import { readConfig } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";
import { execFile } from "node:child_process";
import { unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPlannedReleaseStatus } from "./verify-release-readiness.mjs";
import { assertRecoveryEligible, readRecovery } from "./release-recovery.mjs";
import { freezeUnplannedInitializers } from "./freeze-unplanned-initializers.mjs";
import { recordReleaseOrigin } from "./record-release-origin.mjs";

const exec = promisify(execFile);
export async function versionPackages({ root = process.cwd(), env = process.env, validate = true } = {}) {
  const receipt = await readRecovery(root);
  if (receipt) {
    if (validate) await assertRecoveryEligible(receipt, { sourceSha: env.GITHUB_SHA });
    const packages = await getPackages(root);
    const { config } = await readConfig(root, packages);
    await applyReleasePlan(await readPlannedReleaseStatus(root), packages, config, undefined, resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  } else {
    await exec("npm", ["exec", "changeset", "version"], { cwd: root, env });
  }
  await freezeUnplannedInitializers({
    root,
    sourceRef: env.GITHUB_SHA ?? "HEAD",
    restoreFromSource: Boolean(receipt),
  });
  await recordReleaseOrigin(resolve(root, ".release"), env);
  await exec("npm", ["install", "--package-lock-only", "--ignore-scripts"], { cwd: root, env });
  if (receipt) await unlink(resolve(root, ".release/recovery.json"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await versionPackages();
