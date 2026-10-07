import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { gt, inc, major, minor, valid } from "semver";
import { publicPackages } from "./public-packages.mjs";
import { checkReleasePullRequest } from "./check-release-pull-request.mjs";
import { assertProvenance, readProvenance as readRegistryProvenance } from "./verify-registry-release.mjs";

const exec = promisify(execFile);
const execute = async (command, args) => (await exec(command, args, { encoding: "utf8" })).stdout.trim();
const shaPattern = /^[a-f0-9]{40}$/;

export async function readRecovery(root = process.cwd()) {
  try { return JSON.parse(await readFile(join(root, ".release/recovery.json"), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}

// Frozen inputs keep generation and every verifier on the same release plan.
export function recoveryPlan(plan, receipt, names = publicPackages.map(({ name }) => name)) {
  if (!receipt) return plan;
  const expected = plan.releases.filter(({ name, type }) => names.includes(name) && type !== "none").map(({ name }) => name).sort();
  assert.deepEqual(Object.keys(receipt.freshVersions).sort(), expected, "recovery must replace every changed public package");
  assert.deepEqual(Object.keys(receipt.occupiedVersions).sort(), expected, "occupied package set changed");
  return { ...plan, recovery: receipt, releases: plan.releases.map((release) => {
    const fresh = receipt.freshVersions[release.name];
    if (!fresh) return release;
    const occupied = receipt.occupiedVersions[release.name];
    assert.ok(valid(fresh) && valid(occupied), "recovery version is invalid");
    assert.equal(fresh, inc(occupied, "patch"), "recovery must use the next fresh patch on its planned line");
    assert.ok(gt(fresh, release.newVersion), "recovery version must exceed the ordinary plan");
    assert.equal(major(fresh), major(release.newVersion), "recovery changed the planned major line");
    assert.equal(minor(fresh), minor(release.newVersion), "recovery changed the planned minor line");
    return { ...release, newVersion: fresh };
  }) };
}

async function registryPackage(name) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  assert.ok(response.ok, `${name}: registry lookup failed (${response.status})`);
  return response.json();
}

export function recoveryRequiresFailedPublishAncestry(receipt) {
  return receipt?.type !== "staged-candidate";
}

async function assertFailedPublishRecoveryEligible(receipt, { run, readRegistry, sourceSha, candidateSha }) {
  for (const field of ["failedPublishSha", "failedSourceSha", "failedReleaseSha", "previousPublishSha", "occupiedHeadSha"]) assert.match(receipt[field], shaPattern, `${field} is missing`);
  assert.match(sourceSha, shaPattern, "checked recovery source is missing");
  assert.match(String(receipt.failedPublishRunId), /^\d+$/);
  assert.equal((await run("git", ["ls-remote", "origin", "refs/heads/publish"])).split("\t")[0], receipt.failedPublishSha, "failed publish head moved");
  assert.equal(await run("git", ["rev-parse", `${receipt.failedPublishSha}^1`]), receipt.previousPublishSha);
  assert.equal(await run("git", ["rev-parse", `${receipt.failedPublishSha}^2`]), receipt.failedReleaseSha);
  const failedOrigin = JSON.parse(await run("git", ["show", `${receipt.failedPublishSha}:.release/origin.json`]));
  assert.equal(failedOrigin.sha, receipt.failedSourceSha, "failed source changed");
  await run("git", ["merge-base", "--is-ancestor", receipt.failedSourceSha, sourceSha]);
  const listed = JSON.parse(await run("gh", ["api", "-X", "GET", "repos/emseepea/emseepea/actions/workflows/publish.yml/runs", "-f", `head_sha=${receipt.failedPublishSha}`]));
  const runs = listed.workflow_runs ?? [];
  assert.equal(runs.length, 1, "recovery requires one terminal failed Publish run");
  const [failed] = runs;
  assert.equal(String(failed.id), String(receipt.failedPublishRunId));
  assert.equal(failed.head_sha, receipt.failedPublishSha);
  assert.equal(failed.head_branch, "publish");
  assert.equal(failed.path, ".github/workflows/publish.yml");
  assert.equal(failed.event, "push");
  assert.equal(failed.status, "completed");
  assert.equal(failed.conclusion, "failure");
  assert.ok(Number.isInteger(failed.run_attempt) && failed.run_attempt >= 1);
  for (let attempt = 1; attempt <= failed.run_attempt; attempt += 1) {
    const { jobs } = JSON.parse(await run("gh", ["api", `repos/emseepea/emseepea/actions/runs/${failed.id}/attempts/${attempt}/jobs`]));
    const promote = jobs.find(({ name }) => name === "Promote the release to latest");
    assert.equal(promote?.conclusion, "failure", "previous promotion was not stopped");
    assert.equal(promote.steps.find(({ name }) => name === "Bind promotion to the checked release run")?.conclusion, "failure");
    assert.equal(promote.steps.find(({ name }) => name === "Move each package's next tag to latest")?.conclusion, "skipped", "promotion was attempted");
  }
  assert.deepEqual(Object.keys(receipt.latestVersions).sort(), publicPackages.map(({ name }) => name).sort(), "complete latest baseline is required");
  await Promise.all(publicPackages.map(async ({ name, path }) => {
    const previous = JSON.parse(await run("git", ["show", `${receipt.previousPublishSha}:${path}/package.json`]));
    assert.equal(receipt.latestVersions[name], previous.version, `${name}: baseline differs from previous publication`);
    const metadata = await readRegistry(name);
    assert.equal(metadata["dist-tags"].latest, previous.version, `${name}: latest baseline changed`);
    const occupied = receipt.occupiedVersions[name];
    const abandoned = JSON.parse(await run("git", ["show", `${receipt.failedPublishSha}:${path}/package.json`]));
    if (!occupied) { assert.equal(abandoned.version, previous.version, `${name}: missing occupied version`); return; }
    assert.equal(abandoned.version, occupied, `${name}: abandoned version changed`);
    assert.equal(metadata.versions[occupied]?.gitHead, receipt.occupiedHeadSha, `${name}: occupied source changed`);
    const fresh = metadata.versions[receipt.freshVersions[name]];
    assert.ok(!fresh || (candidateSha && fresh.gitHead === candidateSha), `${name}: fresh version is already occupied`);
  }));
}

async function assertRun(run, id, expected) {
  assert.match(String(id), /^\d+$/, `${expected.path} run is missing`);
  const actual = JSON.parse(await run("gh", ["api", `repos/emseepea/emseepea/actions/runs/${id}`]));
  assert.equal(String(actual.id), String(id));
  assert.equal(actual.head_sha, expected.sha);
  assert.equal(actual.head_branch, expected.branch);
  assert.equal(actual.path, expected.path);
  assert.equal(actual.event, expected.event);
  assert.equal(actual.status, "completed");
  assert.equal(actual.conclusion, expected.conclusion ?? "success");
  assert.ok(Number.isInteger(actual.run_attempt) && actual.run_attempt >= 1);
  return actual;
}

function exactlyOne(items, name, description) {
  const matches = items.filter((item) => item.name === name);
  assert.equal(matches.length, 1, `expected exactly one ${description}`);
  return matches[0];
}

async function assertFailedStagingRun(run, actual) {
  for (let attempt = 1; attempt <= actual.run_attempt; attempt += 1) {
    const { jobs } = JSON.parse(await run("gh", ["api", `repos/emseepea/emseepea/actions/runs/${actual.id}/attempts/${attempt}/jobs`]));
    const semantic = exactlyOne(jobs, "Check whether examples are understood", "staged semantic job");
    const publish = exactlyOne(jobs, "Publish the release under next", "staged publication job");
    assert.equal(semantic?.conclusion, "success", "staged semantic evidence did not pass");
    assert.equal(publish?.conclusion, "failure", "failed staging run did not stop in publication verification");
    assert.equal(exactlyOne(publish.steps, "Publish the packages under next", "staged publish step").conclusion, "success");
    assert.equal(exactlyOne(publish.steps, "Verify the packages reached the registry under next", "staged registry verification step").conclusion, "failure");
    assert.equal(exactlyOne(publish.steps, "Verify the downloaded packages", "staged download verification step").conclusion, "skipped");
    assert.equal(exactlyOne(publish.steps, "Upload the release artifacts for the promotion", "staged artifact upload step").conclusion, "skipped");
  }
}

async function isAncestor(run, ancestor, descendant) {
  try {
    await run("git", ["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch (error) {
    if (error.code === 1) return false;
    throw error;
  }
}

async function assertStagedCandidateRecoveryEligible(receipt, {
  run,
  readRegistry,
  readProvenance,
  sourceSha,
  candidateSha,
}) {
  for (const field of ["stagedSourceSha", "stagedReleaseSha"]) assert.match(receipt[field], shaPattern, `${field} is missing`);
  assert.match(sourceSha, shaPattern, "checked recovery source is missing");
  // The abandoned release candidate is no longer named by the release branch,
  // so a fresh Actions checkout will not contain it even with main history.
  await run("git", ["fetch", "origin", receipt.stagedReleaseSha]);
  assert.equal(
    await run("git", ["rev-list", "--parents", "-n", "1", receipt.stagedReleaseSha]),
    `${receipt.stagedReleaseSha} ${receipt.stagedSourceSha}`,
    "staged candidate source changed",
  );
  const origin = JSON.parse(await run("git", ["show", `${receipt.stagedReleaseSha}:.release/origin.json`]));
  assert.equal(origin.sha, receipt.stagedSourceSha, "staged candidate source changed");
  assert.equal(String(origin.qualityRunId), String(receipt.stagedQualityRunId), "staged candidate Quality run changed");
  await run("git", ["merge-base", "--is-ancestor", receipt.stagedSourceSha, sourceSha]);
  const publishSha = (await run("git", ["ls-remote", "origin", "refs/heads/publish"])).split("\t")[0];
  assert.match(publishSha, shaPattern, "publish head is missing");
  assert.equal(
    await isAncestor(run, receipt.stagedReleaseSha, publishSha),
    false,
    "staged candidate already reached publish",
  );
  await assertRun(run, receipt.stagedQualityRunId, {
    sha: receipt.stagedSourceSha,
    branch: "main",
    path: ".github/workflows/quality.yml",
    event: "push",
  });
  const releaseConclusion = receipt.stagedReleaseRunConclusion ?? "success";
  assert.ok(["success", "failure"].includes(releaseConclusion), "staged Release conclusion is not eligible");
  const release = await assertRun(run, receipt.stagedReleaseRunId, {
    sha: receipt.stagedReleaseSha,
    branch: "changeset-release/publish",
    path: ".github/workflows/release.yml",
    event: "workflow_dispatch",
    conclusion: releaseConclusion,
  });
  if (release.conclusion === "failure") await assertFailedStagingRun(run, release);
  assert.deepEqual(Object.keys(receipt.latestVersions).sort(), publicPackages.map(({ name }) => name).sort(), "complete latest baseline is required");
  await Promise.all(publicPackages.map(async ({ name, path }) => {
    const baseline = JSON.parse(await run("git", ["show", `${receipt.stagedSourceSha}:${path}/package.json`]));
    assert.equal(receipt.latestVersions[name], baseline.version, `${name}: baseline differs from staged source`);
    const staged = JSON.parse(await run("git", ["show", `${receipt.stagedReleaseSha}:${path}/package.json`]));
    const metadata = await readRegistry(name);
    assert.equal(metadata["dist-tags"].latest, baseline.version, `${name}: latest baseline changed`);
    const occupied = receipt.occupiedVersions[name];
    if (!occupied) {
      assert.equal(staged.version, baseline.version, `${name}: missing occupied version`);
      return;
    }
    assert.equal(staged.version, occupied, `${name}: staged occupied version changed`);
    const occupiedMetadata = metadata.versions[occupied];
    assert.equal(occupiedMetadata?.gitHead, receipt.stagedReleaseSha, `${name}: occupied source changed`);
    assert.match(occupiedMetadata?.dist?.integrity ?? "", /^sha512-/, `${name}: occupied integrity is missing`);
    assert.ok(occupiedMetadata?.dist?.attestations?.url, `${name}: occupied provenance is missing`);
    const statement = await readProvenance({ attestationsUrl: occupiedMetadata.dist.attestations.url });
    assertProvenance(statement, {
      ref: "refs/heads/changeset-release/publish",
      repository: "https://github.com/emseepea/emseepea",
      workflowPath: ".github/workflows/release.yml",
      invocationPrefix: `https://github.com/emseepea/emseepea/actions/runs/${receipt.stagedReleaseRunId}/`,
      sha: receipt.stagedReleaseSha,
      subject: `pkg:npm/${encodeURIComponent(name).replace("%2F", "/")}@${occupied}`,
      sha512: Buffer.from(occupiedMetadata.dist.integrity.slice("sha512-".length), "base64").toString("hex"),
    });
    const fresh = metadata.versions[receipt.freshVersions[name]];
    assert.ok(!fresh || (candidateSha && fresh.gitHead === candidateSha), `${name}: fresh version is already occupied`);
  }));
}

export async function assertRecoveryEligible(receipt, {
  run = execute,
  readRegistry = registryPackage,
  readProvenance = readRegistryProvenance,
  sourceSha = process.env.GITHUB_SHA,
  candidateSha,
} = {}) {
  if (receipt?.type === "staged-candidate") {
    return assertStagedCandidateRecoveryEligible(receipt, { run, readRegistry, readProvenance, sourceSha, candidateSha });
  }
  assert.equal(receipt?.type, undefined, "unknown recovery type");
  return assertFailedPublishRecoveryEligible(receipt, { run, readRegistry, sourceSha, candidateSha });
}

export async function finalizeRecovery({ run = execute, sourceSha = process.env.GITHUB_SHA, qualityRunId = process.env.GITHUB_RUN_ID, readRegistry, readProvenance, receipt, checkPlan } = {}) {
  if (receipt === undefined) {
    const files = await run("git", ["ls-tree", "--name-only", sourceSha, ".release/recovery.json"]);
    if (!files) return;
    receipt = JSON.parse(await run("git", ["show", `${sourceSha}:.release/recovery.json`]));
  }
  if (!receipt) return;
  await assertRecoveryEligible(receipt, { run, sourceSha, readRegistry, readProvenance });
  const branch = "refs/heads/changeset-release/publish";
  const generated = (await run("git", ["ls-remote", "origin", branch])).split("\t")[0];
  assert.match(generated, shaPattern);
  await run("git", ["fetch", "origin", generated]);
  const origin = JSON.parse(await run("git", ["show", `${generated}:.release/origin.json`]));
  assert.equal(origin.sha, sourceSha, "generated candidate source changed");
  assert.equal(String(origin.qualityRunId), String(qualityRunId), "generated candidate Quality run changed");
  assert.equal((await run("git", ["ls-remote", "origin", "refs/heads/main"])).split("\t")[0], sourceSha, "checked source moved");
  await (checkPlan ?? checkReleasePullRequest)(sourceSha, generated, { run, requireRecoveryAncestry: false, qualityRunId });
  if (!recoveryRequiresFailedPublishAncestry(receipt)) return;
  const tree = await run("git", ["rev-parse", `${generated}^{tree}`]);
  const created = JSON.parse(await run("gh", ["api", "repos/emseepea/emseepea/git/commits", "-f", "message=Checked replacement release candidate", "-f", `tree=${tree}`, "-f", `parents[]=${generated}`, "-f", `parents[]=${receipt.failedPublishSha}`]));
  assert.match(created.sha, shaPattern);
  assert.equal(created.tree.sha, tree, "replacement changed the generated tree");
  assert.deepEqual(created.parents.map(({ sha }) => sha), [generated, receipt.failedPublishSha]);
  assert.equal((await run("git", ["ls-remote", "origin", branch])).split("\t")[0], generated, "generated candidate moved");
  await run("gh", ["api", "--method", "PATCH", "repos/emseepea/emseepea/git/refs/heads/changeset-release/publish", "-f", `sha=${created.sha}`, "-F", "force=false"]);
  await run("git", ["fetch", "origin", created.sha]);
  assert.equal(await run("git", ["rev-parse", `${created.sha}^{tree}`]), tree);
  for (const ancestor of [sourceSha, receipt.failedPublishSha]) await run("git", ["merge-base", "--is-ancestor", ancestor, created.sha]);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (process.argv[2] === "finalize") await finalizeRecovery();
  else {
    const receipt = await readRecovery();
    if (receipt) await assertRecoveryEligible(receipt);
    else await execute("git", ["merge-base", "--is-ancestor", "origin/publish", process.env.GITHUB_SHA]);
  }
}
