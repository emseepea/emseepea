import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { assertRecoveryEligible, finalizeRecovery, recoveryPlan } from "../../scripts/release-recovery.mjs";
import { versionPackages } from "../../scripts/version-packages.mjs";
import { publicPackages } from "../../scripts/public-packages.mjs";

const receipt = {
  "failedPublishSha": "044e9e2d96869b586332dfcd0d840f3ee18314ec",
  "failedPublishRunId": "37306377237",
  "previousPublishSha": "261b7a8ff5f43fb341bbac549e51b19c5d09532d",
  "failedSourceSha": "e23ea4dd6d3e3604bb22da11a7d1e0c66ea1d6bd",
  "failedReleaseSha": "9923cf5a71fd4a2da330d1aed110e14b479d3792",
  "occupiedHeadSha": "b7906dd6fb5929224466bd060d56b36c5b7c10b4",
  "latestVersions": {
    "@emseepea/server": "0.21.1",
    "@emseepea/feedback": "0.6.0",
    "@emseepea/testing": "0.20.3",
    "@emseepea/react": "0.4.4",
    "@emseepea/svelte": "0.2.4",
    "@emseepea/tailwind": "0.1.1",
    "@emseepea/create-tool-server": "0.1.5",
    "@emseepea/create-api-backed-server": "0.1.5",
    "@emseepea/create-openapi-backed-server": "0.1.5",
    "@emseepea/create-resources-and-prompts-server": "0.1.5",
    "@emseepea/create-progress-streaming-server": "0.1.5",
    "@emseepea/create-html-ui-server": "0.1.5",
    "@emseepea/create-react-ui-server": "0.1.5",
    "@emseepea/create-multi-instance-postgres-server": "0.1.5",
    "@emseepea/create-database-schema-server": "0.1.5",
    "@emseepea/create-mongodb-backed-server": "0.1.5",
    "@emseepea/create-soap-backed-server": "0.1.5"
  },
  "occupiedVersions": {
    "@emseepea/server": "0.22.0",
    "@emseepea/feedback": "0.7.0",
    "@emseepea/testing": "0.20.4",
    "@emseepea/react": "0.4.5",
    "@emseepea/svelte": "0.2.5",
    "@emseepea/create-tool-server": "0.1.6",
    "@emseepea/create-api-backed-server": "0.1.6",
    "@emseepea/create-openapi-backed-server": "0.1.6",
    "@emseepea/create-resources-and-prompts-server": "0.1.6",
    "@emseepea/create-progress-streaming-server": "0.1.6",
    "@emseepea/create-html-ui-server": "0.1.6",
    "@emseepea/create-react-ui-server": "0.1.6",
    "@emseepea/create-multi-instance-postgres-server": "0.1.6",
    "@emseepea/create-database-schema-server": "0.1.6",
    "@emseepea/create-mongodb-backed-server": "0.1.6",
    "@emseepea/create-soap-backed-server": "0.1.6"
  },
  "freshVersions": {
    "@emseepea/server": "0.22.1",
    "@emseepea/feedback": "0.7.1",
    "@emseepea/testing": "0.20.5",
    "@emseepea/react": "0.4.6",
    "@emseepea/svelte": "0.2.6",
    "@emseepea/create-tool-server": "0.1.7",
    "@emseepea/create-api-backed-server": "0.1.7",
    "@emseepea/create-openapi-backed-server": "0.1.7",
    "@emseepea/create-resources-and-prompts-server": "0.1.7",
    "@emseepea/create-progress-streaming-server": "0.1.7",
    "@emseepea/create-html-ui-server": "0.1.7",
    "@emseepea/create-react-ui-server": "0.1.7",
    "@emseepea/create-multi-instance-postgres-server": "0.1.7",
    "@emseepea/create-database-schema-server": "0.1.7",
    "@emseepea/create-mongodb-backed-server": "0.1.7",
    "@emseepea/create-soap-backed-server": "0.1.7"
  }
};
const source = "a".repeat(40);
const candidate = "b".repeat(40);
const final = "c".repeat(40);
const tree = "d".repeat(40);
const failed = { id: Number(receipt.failedPublishRunId), head_sha: receipt.failedPublishSha, head_branch: "publish", path: ".github/workflows/publish.yml", event: "push", status: "completed", conclusion: "failure", run_attempt: 1 };
const jobs = [{ name: "Promote the release to latest", conclusion: "failure", steps: [
  { name: "Bind promotion to the checked release run", conclusion: "failure" },
  { name: "Move each package's next tag to latest", conclusion: "skipped" },
] }];

function harness(overrides = {}) {
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined.startsWith("ls-remote")) {
      if (joined.endsWith("refs/heads/publish")) return `${overrides.publish ?? receipt.failedPublishSha}\trefs/heads/publish`;
      if (joined.endsWith("refs/heads/main")) return `${overrides.source ?? source}\trefs/heads/main`;
      return `${candidate}\trefs/heads/changeset-release/publish`;
    }
    if (joined === `rev-parse ${receipt.failedPublishSha}^1`) return receipt.previousPublishSha;
    if (joined === `rev-parse ${receipt.failedPublishSha}^2`) return receipt.failedReleaseSha;
    if (joined === `show ${receipt.failedPublishSha}:.release/origin.json`) return JSON.stringify({ sha: receipt.failedSourceSha });
    if (joined === `show ${candidate}:.release/origin.json`) return JSON.stringify({ sha: source, qualityRunId: "123" });
    if (joined.startsWith(`show ${receipt.previousPublishSha}:`) || joined.startsWith(`show ${receipt.failedPublishSha}:`)) {
      const item = publicPackages.find(({ path }) => joined.endsWith(`${path}/package.json`));
      return JSON.stringify({ version: joined.startsWith(`show ${receipt.previousPublishSha}:`) ? receipt.latestVersions[item.name] : receipt.occupiedVersions[item.name] ?? receipt.latestVersions[item.name] });
    }
    if (joined.includes("actions/workflows/publish.yml/runs")) return JSON.stringify({ workflow_runs: overrides.runs ?? [failed] });
    if (joined.includes("/jobs")) return JSON.stringify({ jobs: overrides.jobs ?? jobs });
    if (joined.includes("git/commits")) return JSON.stringify({ sha: final, tree: { sha: overrides.tree ?? tree }, parents: [{ sha: candidate }, { sha: receipt.failedPublishSha }] });
    if (joined.startsWith("rev-parse") && joined.endsWith("^{tree}")) return tree;
    return "";
  };
  const readRegistry = async (name) => ({ "dist-tags": { latest: overrides.latest ?? receipt.latestVersions[name] }, versions: {
    [receipt.occupiedVersions[name]]: { gitHead: receipt.occupiedHeadSha },
    ...(overrides.occupiedFresh ? { [receipt.freshVersions[name]]: { gitHead: overrides.occupiedFresh } } : {}),
  } });
  return { calls, run, readRegistry, sourceSha: source, qualityRunId: "123" };
}

const stagedSource = "e".repeat(40);
const stagedCandidate = "f".repeat(40);
const publishHead = "9".repeat(40);
const stagedRunId = "37565328520";
const stagedReceipt = {
  type: "staged-candidate",
  stagedSourceSha: stagedSource,
  stagedReleaseSha: stagedCandidate,
  stagedReleaseRunId: stagedRunId,
  stagedReleaseRunConclusion: "failure",
  stagedQualityRunId: "37564409521",
  latestVersions: Object.fromEntries(publicPackages.map(({ name }) => [name, name === "@emseepea/testing" ? "0.20.5" : "1.0.0"])),
  occupiedVersions: { "@emseepea/testing": "0.21.1" },
  freshVersions: { "@emseepea/testing": "0.21.2" },
};

function stagedHarness(overrides = {}) {
  const calls = [];
  const release = {
    id: Number(stagedRunId),
    head_sha: overrides.releaseHead ?? stagedCandidate,
    head_branch: "changeset-release/publish",
    path: ".github/workflows/release.yml",
    event: "workflow_dispatch",
    status: overrides.releaseStatus ?? "completed",
    conclusion: overrides.releaseConclusion ?? stagedReceipt.stagedReleaseRunConclusion,
    run_attempt: 3,
  };
  const quality = {
    id: Number(stagedReceipt.stagedQualityRunId),
    head_sha: stagedSource,
    head_branch: "main",
    path: ".github/workflows/quality.yml",
    event: "push",
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
  };
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined === `rev-list --parents -n 1 ${stagedCandidate}`) return `${stagedCandidate} ${overrides.parent ?? stagedSource}`;
    if (joined === `show ${stagedCandidate}:.release/origin.json`) {
      return JSON.stringify({ sha: overrides.recordedSource ?? stagedSource, qualityRunId: stagedReceipt.stagedQualityRunId });
    }
    if (joined === `show ${candidate}:.release/origin.json`) return JSON.stringify({ sha: source, qualityRunId: "123" });
    if (joined === `show ${stagedSource}:packages/testing/package.json`) return JSON.stringify({ version: "0.20.5" });
    if (joined === `show ${stagedCandidate}:packages/testing/package.json`) return JSON.stringify({ version: "0.21.1" });
    if (joined.startsWith(`show ${stagedSource}:`) || joined.startsWith(`show ${stagedCandidate}:`)) {
      const item = publicPackages.find(({ path }) => joined.endsWith(`${path}/package.json`));
      return JSON.stringify({ version: stagedReceipt.latestVersions[item.name] });
    }
    if (joined === `api repos/emseepea/emseepea/actions/runs/${stagedRunId}`) return JSON.stringify(release);
    if (joined === `api repos/emseepea/emseepea/actions/runs/${stagedReceipt.stagedQualityRunId}`) return JSON.stringify(quality);
    if (joined.includes(`/actions/runs/${stagedRunId}/attempts/`) && joined.endsWith("/jobs")) {
      const semantic = { name: "Check whether examples are understood", conclusion: overrides.semanticConclusion ?? "success", steps: [] };
      const publishStep = { name: "Publish the packages under next", conclusion: overrides.publishConclusion ?? "success" };
      const publish = { name: "Publish the release under next", conclusion: "failure", steps: [
        publishStep,
        ...(overrides.duplicateStep ? [publishStep] : []),
        { name: "Verify the packages reached the registry under next", conclusion: overrides.verifyConclusion ?? "failure" },
        { name: "Verify the downloaded packages", conclusion: overrides.downloadConclusion ?? "skipped" },
        { name: "Upload the release artifacts for the promotion", conclusion: overrides.uploadConclusion ?? "skipped" },
      ] };
      return JSON.stringify({ jobs: [semantic, ...(overrides.duplicateSemantic ? [semantic] : []), publish] });
    }
    if (joined === `merge-base --is-ancestor ${stagedCandidate} ${publishHead}`) {
      if (overrides.merged) return "";
      throw Object.assign(new Error("not an ancestor"), { code: 1 });
    }
    if (joined.startsWith("ls-remote") && joined.endsWith("refs/heads/publish")) return `${publishHead}\trefs/heads/publish`;
    if (joined.startsWith("ls-remote") && joined.endsWith("refs/heads/main")) return `${overrides.source ?? source}\trefs/heads/main`;
    if (joined.startsWith("ls-remote")) return `${candidate}\trefs/heads/changeset-release/publish`;
    return "";
  };
  const readRegistry = async (name) => ({
    "dist-tags": { latest: overrides.latest ?? stagedReceipt.latestVersions[name] },
    versions: name === "@emseepea/testing" ? {
      "0.21.1": {
        gitHead: overrides.occupiedHead ?? stagedCandidate,
        dist: {
          integrity: "sha512-AQ==",
          attestations: { url: "https://registry.example/attestations" },
        },
      },
      ...(overrides.occupiedFresh ? { "0.21.2": { gitHead: overrides.occupiedFresh } } : {}),
    } : {},
  });
  const readProvenance = async () => ({
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ name: "pkg:npm/%40emseepea/testing@0.21.1", digest: { sha512: "01" } }],
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: {
          ref: "refs/heads/changeset-release/publish",
          repository: "https://github.com/emseepea/emseepea",
          path: ".github/workflows/release.yml",
        } },
        resolvedDependencies: [{ digest: { gitCommit: overrides.provenanceHead ?? stagedCandidate } }],
      },
      runDetails: { metadata: { invocationId: `https://github.com/emseepea/emseepea/actions/runs/${stagedRunId}/attempts/1` } },
    },
  });
  return { calls, run, readRegistry, readProvenance, sourceSha: source, qualityRunId: "123" };
}

test("recovery keeps ordinary release types and selects frozen fresh patches only", () => {
  const ordinary = { releases: Object.entries(receipt.occupiedVersions).map(([name, newVersion]) => ({ name, newVersion, oldVersion: receipt.latestVersions[name], type: name === "@emseepea/server" ? "minor" : "patch", changesets: ["feature"] })) };
  assert.equal(recoveryPlan(ordinary), ordinary);
  const plan = recoveryPlan(ordinary, receipt);
  for (const [index, release] of plan.releases.entries()) assert.deepEqual(release, { ...ordinary.releases[index], newVersion: receipt.freshVersions[release.name] });
  for (const mutate of [
    (r) => { delete r.freshVersions["@emseepea/server"]; },
    (r) => { r.freshVersions["@emseepea/server"] = "1.0.0"; },
    (r) => { r.freshVersions["@emseepea/server"] = "0.22.0"; },
    (r) => { r.occupiedVersions["@emseepea/server"] = "0.23.0"; r.freshVersions["@emseepea/server"] = "0.23.1"; },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    assert.throws(() => recoveryPlan(ordinary, changed));
  }
});

test("recovery refuses moved history, attempted promotion, changed latest and occupied fresh versions", async () => {
  await assertRecoveryEligible(receipt, harness());
  for (const overrides of [
    { publish: source },
    { runs: [] },
    { runs: [failed, failed] },
    { runs: [{ ...failed, status: "in_progress" }] },
    { runs: [{ ...failed, conclusion: "success" }] },
    { runs: [{ ...failed, head_sha: source }] },
    { jobs: [{ ...jobs[0], steps: [jobs[0].steps[0], { ...jobs[0].steps[1], conclusion: "success" }] }] },
    { latest: "9.0.0" },
    { occupiedFresh: source },
  ]) await assert.rejects(() => assertRecoveryEligible(receipt, harness(overrides)));
  await assertRecoveryEligible(receipt, { ...harness({ occupiedFresh: candidate }), candidateSha: candidate });
});

test("staged-candidate recovery binds the occupied version to one eligible terminal release and provenance", async () => {
  const eligible = stagedHarness();
  await assertRecoveryEligible(stagedReceipt, eligible);
  await assertRecoveryEligible(stagedReceipt, stagedHarness({ verifyConclusion: "success", downloadConclusion: "failure" }));
  // A depth-limited fetch would make this commit a shallow boundary and hide
  // older, valid package provenance from the later registry verifier.
  assert.deepEqual(eligible.calls[0], ["git", "fetch", "origin", stagedCandidate]);
  for (const overrides of [
    { parent: candidate },
    { recordedSource: candidate },
    { releaseHead: candidate },
    { releaseStatus: "in_progress" },
    { releaseConclusion: "success" },
    { semanticConclusion: "failure" },
    { publishConclusion: "failure" },
    { verifyConclusion: "success" },
    { downloadConclusion: "success" },
    { verifyConclusion: "success", downloadConclusion: "skipped" },
    { verifyConclusion: "failure", downloadConclusion: "failure" },
    { verifyConclusion: "success", downloadConclusion: "cancelled" },
    { uploadConclusion: "success" },
    { duplicateSemantic: true },
    { duplicateStep: true },
    { latest: "9.0.0" },
    { occupiedHead: candidate },
    { provenanceHead: candidate },
    { merged: true },
    { occupiedFresh: stagedCandidate },
  ]) await assert.rejects(() => assertRecoveryEligible(stagedReceipt, stagedHarness(overrides)));
  for (const conclusion of ["cancelled", "timed_out"]) {
    const unsupported = structuredClone(stagedReceipt);
    unsupported.stagedReleaseRunConclusion = conclusion;
    await assert.rejects(
      () => assertRecoveryEligible(unsupported, stagedHarness({ releaseConclusion: conclusion })),
      /conclusion is not eligible/,
    );
  }
  await assertRecoveryEligible(stagedReceipt, { ...stagedHarness({ occupiedFresh: candidate }), candidateSha: candidate });
  const successfulReceipt = structuredClone(stagedReceipt);
  delete successfulReceipt.stagedReleaseRunConclusion;
  await assertRecoveryEligible(successfulReceipt, stagedHarness({ releaseConclusion: "success" }));
});

test("staged-candidate finalization keeps ordinary candidate ancestry", async () => {
  const state = stagedHarness();
  await finalizeRecovery({ ...state, receipt: stagedReceipt, checkPlan: async (base, head, options) => {
    assert.equal(base, source);
    assert.equal(head, candidate);
    assert.equal(options.requireRecoveryAncestry, false);
  } });
  assert.equal(state.calls.some((call) => call.includes("git/commits")), false);
  assert.equal(state.calls.some((call) => call.includes("PATCH")), false);
});

test("replacement finalizer preserves the generated tree and updates only non-force candidate history", async () => {
  const state = harness();
  await finalizeRecovery({ ...state, receipt, checkPlan: async (base, head, options) => {
    assert.equal(base, source); assert.equal(head, candidate); assert.equal(options.requireRecoveryAncestry, false);
  } });
  const create = state.calls.find(([command, ...args]) => command === "gh" && args.includes("repos/emseepea/emseepea/git/commits"));
  assert.ok(create.includes(`parents[]=${candidate}`));
  assert.ok(create.includes(`parents[]=${receipt.failedPublishSha}`));
  const update = state.calls.find((call) => call.includes("PATCH"));
  assert.ok(update.includes("force=false"));
  for (const overrides of [{ tree: source }, { source: candidate }]) {
    const refused = harness(overrides);
    await assert.rejects(() => finalizeRecovery({ ...refused, receipt, checkPlan: async () => {} }));
    assert.equal(refused.calls.some((call) => call.includes("PATCH")), false);
  }
});

test("finalizer CLI reaches its required plan check without an import deadlock", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-recovery-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const preload = join(directory, "preload.mjs");
  await writeFile(preload, `
    import childProcess from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    import { promisify } from "node:util";
    const receipt = ${JSON.stringify(receipt)};
    const source = ${JSON.stringify(source)}, candidate = ${JSON.stringify(candidate)}, final = ${JSON.stringify(final)}, tree = ${JSON.stringify(tree)};
    const failed = ${JSON.stringify(failed)}, jobs = ${JSON.stringify(jobs)}, publicPackages = ${JSON.stringify(publicPackages)};
    ${harness.toString()}
    const state = harness();
    childProcess.execFile = Object.assign(() => { throw new Error("unexpected callback execution"); }, {
      [promisify.custom]: async (command, args) => {
        if (args.join(" ") === "ls-tree --name-only " + source + " .release/recovery.json") return { stdout: ".release/recovery.json" };
        if (args.join(" ") === "show " + source + ":.release/recovery.json") return { stdout: JSON.stringify(receipt) };
        if (args[0] === "worktree" && args[1] === "add") throw new Error("CLI reached required release plan check");
        if (args.includes("git/commits") || args.includes("PATCH")) throw new Error("unexpected candidate write");
        return { stdout: await state.run(command, args) };
      },
    });
    syncBuiltinESMExports();
    globalThis.fetch = async (url) => ({ ok: true, json: () => state.readRegistry(decodeURIComponent(new URL(url).pathname.slice(1))) });
  `);
  const result = await promisify(execFile)(process.execPath, ["--import", preload, "scripts/release-recovery.mjs", "finalize"], {
    encoding: "utf8", timeout: 15_000, env: { ...process.env, GITHUB_SHA: source, GITHUB_RUN_ID: "123" },
  }).catch((error) => error);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /CLI reached required release plan check/);
  assert.doesNotMatch(result.stderr, /unsettled top-level await|unexpected candidate write/);
});

test("official recovery generation updates versions, starter pins, changelogs and consumes its receipt", { timeout: 180_000 }, async (t) => {
  const exec = promisify(execFile);
  const run = async (command, args) => (await exec(command, args, { encoding: "utf8" })).stdout.trim();
  const directory = await mkdtemp(join(tmpdir(), "emseepea-recovery-integration-"));
  await run("git", ["worktree", "add", "--detach", directory, receipt.failedSourceSha]);
  t.after(async () => {
    await run("git", ["worktree", "remove", "--force", directory]);
    await rm(directory, { recursive: true, force: true });
  });
  // The fixture source freezes the same recovery input without changing this checkout.
  await writeFile(join(directory, ".release/recovery.json"), JSON.stringify(receipt));
  // Exercise official changelog generation without requiring a credential in local tests.
  const config = JSON.parse(await readFile(join(directory, ".changeset/config.json"), "utf8"));
  config.changelog = ["@changesets/changelog-git", {}];
  await writeFile(join(directory, ".changeset/config.json"), JSON.stringify(config));
  await run("git", ["-C", directory, "add", ".release/recovery.json", ".changeset/config.json"]);
  await run("git", ["-C", directory, "-c", "core.hooksPath=/dev/null", "-c", "user.name=Recovery Fixture", "-c", "user.email=recovery-fixture@example.com", "commit", "-m", "Recovery generation fixture"]);
  const base = await run("git", ["-C", directory, "rev-parse", "HEAD"]);
  const origin = { sha: base, qualityRunId: "123", recordedAt: "2026-10-06T00:00:00.000Z" };
  await versionPackages({ root: directory, validate: false, env: { ...process.env,
    GITHUB_SHA: base, GITHUB_RUN_ID: origin.qualityRunId, EMSEEPEA_RELEASE_ORIGIN_TIME: origin.recordedAt,
  } });
  const manifest = JSON.parse(await readFile(join(directory, "packages/framework/package.json"), "utf8"));
  assert.equal(manifest.version, "0.22.1");
  const starter = JSON.parse(await readFile(join(directory, "examples/tool-server/package.json"), "utf8"));
  assert.equal(starter.devDependencies["@emseepea/server"], "0.22.1");
  assert.equal(starter.version, "0.1.7");
  assert.match(await readFile(join(directory, "packages/framework/CHANGELOG.md"), "utf8"), /## 0\.22\.1/);
  await assert.rejects(readFile(join(directory, ".release/recovery.json")), { code: "ENOENT" });
  const lock = JSON.parse(await readFile(join(directory, "package-lock.json"), "utf8"));
  assert.equal(lock.packages["packages/framework"].version, "0.22.1");
  assert.deepEqual(JSON.parse(await readFile(join(directory, ".release/origin.json"), "utf8")), origin);
});
