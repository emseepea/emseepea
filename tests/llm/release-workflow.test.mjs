import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { parse as parseYaml } from "yaml";

import { ensureReleaseTag } from "../../scripts/ensure-release-tag.mjs";
import { packRegistryPackage } from "../../scripts/pack-registry-package.mjs";
import { assertPackedTargets } from "../../scripts/verify-packed-package.mjs";
import { extractReleaseNotes } from "../../scripts/prepare-release-artifacts.mjs";
import { publicPackages } from "../../scripts/public-packages.mjs";
import {
  assertProvenance,
  assertRegistryState,
  classifyPublication,
  provenanceCommit,
  provenanceIncludesCommit,
  readProvenance,
  waitForPublication,
} from "../../scripts/verify-registry-release.mjs";
import { useRegistryTarballs } from "../../scripts/use-registry-tarballs.mjs";

// ADR-0098 retires release.yml and splits its work across the release-pull-
// request job in Quality, the build that publishes under `next`, and the
// promotion on merge to `publish`. These assertions follow the work, not the
// old file name.
const releaseBuild = await readFile(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");
const publish = await readFile(new URL("../../.github/workflows/publish.yml", import.meta.url), "utf8");
const quality = await readFile(new URL("../../.github/workflows/quality.yml", import.meta.url), "utf8");
const workflow = `${releaseBuild}\n${publish}`;
const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const serverManifest = JSON.parse(await readFile(new URL("../../packages/framework/package.json", import.meta.url), "utf8"));
const testingManifest = JSON.parse(await readFile(new URL("../../packages/testing/package.json", import.meta.url), "utf8"));
const installedSmoke = await readFile(new URL("../../scripts/verify-installed-package.mjs", import.meta.url), "utf8");
// ADR-0098 moves the evidence document and the release records out of the
// retired workflow and into scripts, so the assertions about their content
// follow them there.
const evidenceWriter = await readFile(new URL("../../scripts/write-release-evidence.mjs", import.meta.url), "utf8");
const evidenceScope = await readFile(new URL("../../scripts/release-evidence-scope.md", import.meta.url), "utf8");
const releaseRecords = await readFile(new URL("../../scripts/publish-release-records.sh", import.meta.url), "utf8");
const evidence = `${evidenceWriter}\n${evidenceScope}`;
const exec = promisify(execFile);

test("every GitHub job uses the recorded npm version", () => {
  for (const source of [quality, workflow]) {
    const setups = source.match(/- name: Set up Node\.js/g) ?? [];
    const activations = source.match(/- name: Use the recorded npm version/g) ?? [];
    assert.equal(activations.length, setups.length);
    assert.equal((source.match(/corepack enable npm/g) ?? []).length, setups.length);
    assert.equal((source.match(/packageManager\.slice\(4\)/g) ?? []).length, setups.length);
  }
});

test("workflows do not use the npm vulnerability advisory", () => {
  for (const source of [quality, workflow]) assert.doesNotMatch(source, /npm audit --audit-level/);
});

test("Quality scans the committed lockfile before initializer qualification", () => {
  const pin = "06b2ab4348248b456ee06c9e953637f55e03504f";
  assert.match(quality, new RegExp(`google/osv-scanner-action/osv-scanner-action@${pin}`));
  assert.match(quality, new RegExp(`google/osv-scanner-action/osv-reporter-action@${pin}`));
  assert.match(quality, /--lockfile=package-lock\.json/);
  assert.match(quality, /--fail-on-vuln=true/);
  assert.match(quality, /vulnerability-scan:[\s\S]*?timeout-minutes: 10/);
  assert.match(quality, /initializer-qualification:[\s\S]*?needs: vulnerability-scan/);
});

test("the Claude subscription check runs only for the publication revision", () => {
  // ADR-0098: the semantic evaluation runs in the release build, on the commit
  // the packages are published from, which is what ADR-0057 requires. That
  // workflow only runs for a release, so no has_publication gate is needed.
  assert.match(
    releaseBuild,
    /- name: Check whether a language model understands every example\n\s+env:\n\s+CLAUDE_CODE_OAUTH_TOKEN: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}\n\s+run: npm run test:eval:ci/,
  );
  assert.match(
    releaseBuild,
    /- name: Upload inspectable language-model evidence\n\s+if: \$\{\{ always\(\) \}\}[\s\S]*retention-days: 14/,
  );
  assert.match(releaseBuild, /name: semantic-eval-\$\{\{ inputs\.head_sha \}\}/);
  assert.doesNotMatch(workflow, /copilot-requests|EMSEEPEA_COPILOT|@github\/copilot/);
  const job = releaseBuild.match(/  semantic-eval:[\s\S]*?\n  publish-next:/)?.[0] ?? "";
  assert.match(job, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(job, /contents: write|id-token: write|pull-requests: write|checks: write/);
  assert.equal((job.match(/CLAUDE_CODE_OAUTH_TOKEN/g) ?? []).length, 2);
  assert.equal(manifest.scripts["claude:prepare"], "node node_modules/@anthropic-ai/claude-code/install.cjs");
  const prepare = job.match(/- name: Prepare the pinned Claude CLI[\s\S]*?(?=\n\s+- name:)/)?.[0] ?? "";
  assert.match(prepare, /2\.1\.248/);
  assert.equal((prepare.match(/npm run claude:prepare/g) ?? []).length, 1);
  assert.match(prepare, /test -x node_modules\/\.bin\/claude/);
  assert.match(prepare, /realpath node_modules\/\.bin\/claude/);
  assert.doesNotMatch(prepare, /CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY/);
  assert.ok(job.indexOf("npm ci --ignore-scripts") < job.indexOf("Prepare the pinned Claude CLI"));
  assert.ok(job.indexOf("Prepare the pinned Claude CLI") < job.indexOf("Check whether a language model understands every example"));
});

test("release preparation and publication do not run when release state is unknown", () => {
  // ADR-0101: the release pull request is opened by a job that depends on the
  // quality jobs, and the build is dispatched only by that job. That chain is
  // what binds publication to a passed scan now that Release is retired.
  const job = quality.match(/  release-pull-request:[\s\S]*/)?.[0] ?? "";
  assert.match(job, /needs: \[initializer-qualification, test, website-performance\]/);
  assert.match(job, /if: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(job, /gh workflow run release\.yml/);
  assert.ok(job.indexOf("changesets/action@") < job.indexOf("gh workflow run release.yml"));
  // Publication waits for the semantic evaluation, and the promotion waits for
  // the publication having been verified.
  assert.match(releaseBuild, /  publish-next:\n\s+name: [^\n]*\n\s+needs: semantic-eval/);
  assert.match(publish, /  deploy-website:[\s\S]*?needs: promote/);
  assert.match(publish, /  merge-back:[\s\S]*?needs: \[promote, deploy-website, release-records\]/);
});

test("release work is derived from changesets and exact package version tags", async () => {
  const { hasUntaggedPublishablePackage } = await import("../../scripts/public-packages.mjs");
  assert.equal(await hasUntaggedPublishablePackage(undefined, async () => true), false);
  assert.equal(await hasUntaggedPublishablePackage(undefined, async (tag) => !tag.startsWith("@emseepea/server@")), true);
  // The release pull request is opened only when a changeset is waiting, and
  // the promotion reads what to publish from the plan rather than from prose.
  assert.match(quality, /echo "has_changesets=true"/);
  assert.match(quality, /find \.changeset -maxdepth 1 -type f -name '\*\.md' ! -name README\.md/);
  assert.match(publish, /read-release-plan\.mjs/);
});

test("versioning refreshes the lockfile", () => {
  assert.equal(
    manifest.scripts["version-packages"],
    "changeset version && node scripts/record-release-origin.mjs && npm install --package-lock-only --ignore-scripts",
  );
  // ADR-0099 deploys the build the quality gate measured, which lives in a
  // different run; the release pull request has to carry a pointer to it.
  assert.match(publish, /quality_run_id/);
});

test("publication evidence uses the canonical public package list", () => {
  assert.match(releaseBuild, /prepare-release-artifacts\.mjs release-artifacts/);
  assert.match(releaseBuild, /public-packages\.mjs --publishable --tsv/);
  assert.match(evidenceWriter, /release-artifacts|\$\{directory\}\/packages\.json/);
  assert.match(workflow, /release-artifacts/);
  assert.match(releaseBuild, /verify-registry-release\.mjs capture/);
  assert.match(releaseBuild, /verify-registry-release\.mjs verify/);
  assert.match(evidenceWriter, /verify-release-readiness\.mjs/);
  assert.match(evidenceWriter, /docs\/reviews\/current-release-readiness\.md/);
  assert.match(releaseBuild, /npm audit signatures/);
  assert.match(releaseBuild, /registry integrity/);
  assert.match(releaseBuild, /provenance/);
  assert.match(releaseRecords, /notes_file/);
  assert.doesNotMatch(workflow, /SERVER_RELEASE_SHA|TESTING_RELEASE_SHA/);
});

test("publication evidence describes the protected progress boundary", () => {
  assert.match(evidence, /checked, bounded public and protected POST progress through a trusted proxy/);
  assert.match(evidence, /the framework authenticates and authorizes protected calls before application code runs or server-sent events begin/);
  assert.doesNotMatch(evidence, /deployed protected streaming tools/);
  assert.match(evidence, /slowing a producer when a client cannot keep up/);
  assert.match(evidence, /opt-in, bounded, process-local resource-update subscriptions/);
  assert.match(evidence, /each stream listens to one registered static resource URI or one concrete URI that matches a registered resource template/);
  assert.match(evidence, /list-change subscriptions, resynchronisation, replay, sessions, or reconnect recovery/);
  assert.match(evidence, /durable or cross-process notification delivery/);
  assert.match(evidence, /framework-managed shared stream state/);
  assert.doesNotMatch(evidence, /resynchronisation, subscriptions, replay/);
  assert.match(evidence, /Subscription load check: `node --expose-gc --test tests\/load\/subscription-sdk\.test\.mjs`/);
  assert.match(evidence, /opt-in, bounded, request-scoped MCP log messages on the calling POST response/);
  assert.match(evidence, /Request-logging load check: `node --expose-gc --test tests\/load\/client-logging\.test\.mjs`/);
});

test("the completed feedback bootstrap cannot remain as a credential fallback", () => {
  assert.doesNotMatch(workflow, /Bootstrap the first feedback publication/);
  assert.doesNotMatch(workflow, /secrets\.NPM_TOKEN/);
});

test("the npm promotion token reaches only the two package-write processes", async () => {
  const definition = parseYaml(publish);
  const sentinel = "promotion-token-sentinel";
  const visible = [];

  for (const [jobName, job] of Object.entries(definition.jobs)) {
    for (const step of job.steps) {
      const configured = {
        ...(definition.env ?? {}),
        ...(job.env ?? {}),
        ...(step.env ?? {}),
      };
      const environment = Object.fromEntries(Object.entries(configured).map(([key, value]) => [
        key,
        value === "${{ secrets.NPM_PROMOTION_TOKEN }}" ? sentinel : String(value),
      ]));
      const { stdout } = await exec(process.execPath, [
        "-e",
        "process.stdout.write(process.env.NODE_AUTH_TOKEN ?? '')",
      ], { env: { PATH: process.env.PATH, ...environment } });
      if (stdout === sentinel) visible.push(`${jobName}: ${step.name}`);
    }
  }

  assert.deepEqual(visible, [
    "promote: Move each package's next tag to latest",
    "release-records: Retire replaced initializers",
  ]);
});

test("registry tarball downloads retry bounded propagation failures", async () => {
  let calls = 0;
  let waits = 0;
  await packRegistryPackage("@emseepea/server@0.2.2", "/tmp/registry", {
    run: async () => { calls += 1; if (calls < 10) throw new Error("not propagated"); },
    wait: async () => { waits += 1; },
  });
  assert.equal(calls, 10);
  assert.equal(waits, 9);

  calls = 0;
  waits = 0;
  await assert.rejects(() => packRegistryPackage("@emseepea/server@0.2.2", "/tmp/registry", {
    run: async () => { calls += 1; throw new Error("still unavailable"); },
    wait: async () => { waits += 1; },
  }), /still unavailable/);
  assert.equal(calls, 10);
  assert.equal(waits, 9);
});

test("release notes must exist before publication", () => {
  assert.equal(extractReleaseNotes("# Changes\n\n## 0.0.1\n\nFirst release.\n", "0.0.1"), "## 0.0.1\n\nFirst release.\n");
  assert.throws(() => extractReleaseNotes("# Changes\n", "0.0.1", "package/CHANGELOG.md"), /package\/CHANGELOG\.md has no 0\.0\.1 release notes/);
});

test("publication builds and verifies packages before creating public releases", () => {
  // ADR-0098 splits this across two workflows: the build publishes under
  // `next` and verifies it there, and the promotion moves the tag and writes
  // the records. The ordering within each still has to hold.
  const job = releaseBuild.match(/  publish-next:[\s\S]*/)?.[0] ?? "";
  assert.ok(job.indexOf("npm ci --ignore-scripts") < job.indexOf("Build packages for publication"));
  assert.ok(job.indexOf("Build packages for publication") < job.indexOf("prepare-release-artifacts.mjs"));
  assert.ok(job.indexOf("prepare-release-artifacts.mjs") < job.indexOf("npm run release:next"));
  assert.ok(job.indexOf("npm run release:next") < job.indexOf("verify-registry-release.mjs verify"));
  assert.ok(job.indexOf("verify-registry-release.mjs verify") < job.indexOf("npm audit signatures"));
  // Nothing reaches `latest` until the packages have been read back and
  // exercised from the registry under `next`.
  assert.ok(job.indexOf("npm audit signatures") < job.indexOf("write-release-targets.mjs"));
  assert.match(quality, /create-github-releases: false/);
  assert.ok(publish.indexOf("promote-release.mjs") < publish.indexOf("publish-release-records.sh"));
  assert.ok(releaseRecords.indexOf("npm audit") === -1);
  assert.match(job, /if: steps\.registry-verify\.outputs\.ready == 'true'/);
  assert.match(job, /EMSEEPEA_GUIDE_PACKAGE_SOURCE=registry node --test tests\/docs\/getting-started-references\.test\.mjs/);
  assert.ok(job.indexOf("verify-registry-release.mjs verify") < job.indexOf("EMSEEPEA_GUIDE_PACKAGE_SOURCE=registry"));
  assert.match(job, /use-registry-tarballs\.mjs release-artifacts registry-artifacts/);
  // ADR-0098: these checks install by dist-tag, and naming `next` is what
  // stops them resolving the previous release.
  assert.match(job, /EMSEEPEA_REGISTRY_DIST_TAG: next/);
  assert.match(releaseRecords, /gh release edit/);
  assert.match(releaseRecords, /gh release create "\$tag" --draft/);
  assert.match(releaseRecords, /gh release edit "\$tag" --draft=false/);
  assert.match(releaseRecords, /gh release view "\$tag" --json assets/);
  assert.match(releaseRecords, /gh release view "\$tag" --json isDraft/);
  assert.match(releaseRecords, /gh release upload "\$tag" "\$@" --clobber/);
  assert.match(releaseRecords, /--latest=false/);
  assert.doesNotMatch(workflow, /steps\.changesets\.outputs\.published/);
});

test("release assets use the exact registry tarballs and matching checksums", async () => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-registry-tarballs-"));
  const releaseDirectory = join(directory, "release");
  const registryDirectory = join(directory, "registry");
  try {
    await mkdir(releaseDirectory);
    await mkdir(registryDirectory);
    await writeFile(join(releaseDirectory, "package.tgz"), "local prepack");
    await writeFile(join(registryDirectory, "package.tgz"), "published bytes");
    await useRegistryTarballs(releaseDirectory, registryDirectory);
    assert.equal(await readFile(join(releaseDirectory, "package.tgz"), "utf8"), "published bytes");
    const digest = createHash("sha256").update("published bytes").digest("hex");
    assert.equal(await readFile(join(releaseDirectory, "SHA256SUMS"), "utf8"), `${digest}  package.tgz\n`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release tags are created at the provenance commit and then verified", () => {
  const tag = "@emseepea/server@0.0.4";
  const sha = "a".repeat(40);
  let target = "";
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args]);
    if (command === "git") return target ? `${target}\trefs/tags/${tag}\n` : "";
    assert.equal(command, "gh");
    target = sha;
    return "";
  };

  ensureReleaseTag(tag, sha, { repository: "emseepea/emseepea", run });
  assert.deepEqual(calls[1], [
    "gh", "api", "--method", "POST", "repos/emseepea/emseepea/git/refs",
    "-f", `ref=refs/tags/${tag}`, "-f", `sha=${sha}`,
  ]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2], calls[0]);
  assert.throws(
    () => ensureReleaseTag(tag, "b".repeat(40), { repository: "emseepea/emseepea", run }),
    /Expected values to be strictly equal/,
  );
});

test("the installed-package smoke uses distinct fixed and template resource routes", async () => {
  assert.match(installedSmoke, /const resourceUri = "smoke:\/\/static\/value"/);
  assert.match(installedSmoke, /uriTemplate: "smoke:\/\/resource\/\{value\}"/);
  assert.match(installedSmoke, /notifyResourceUpdated\(app, resourceUri\)/);
  assert.match(installedSmoke, /notifications\/resources\/updated/);
  assert.match(workflow, /node --input-type=module < "\$GITHUB_WORKSPACE\/scripts\/verify-installed-package\.mjs"/);
  await exec(process.execPath, [fileURLToPath(new URL("../../scripts/verify-installed-package.mjs", import.meta.url))]);
});

test("public packages build themselves before an ordinary pack", () => {
  assert.equal(serverManifest.scripts.prepack, "npm run build");
  assert.equal(testingManifest.scripts.prepack, "npm run build");
});

test("packed-package inspection rejects a missing public target", () => {
  const manifestWithTargets = {
    name: "@example/package",
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    bin: { example: "./bin/example.mjs" },
  };
  const complete = { files: [
    { path: "dist/index.d.ts" },
    { path: "dist/index.js" },
    { path: "bin/example.mjs" },
  ] };
  assert.doesNotThrow(() => assertPackedTargets(manifestWithTargets, complete));
  assert.throws(
    () => assertPackedTargets(manifestWithTargets, { files: complete.files.slice(1) }),
    /missing \.\/dist\/index\.d\.ts/,
  );
});

test("registry capture keeps each package's own release version", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "emseepea-registry-capture-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const item of publicPackages) {
    const version = item.name === "@emseepea/server" ? "0.0.3" : item.name === "@emseepea/testing" ? "0.1.0" : "0.0.0";
    await mkdir(join(cwd, item.path), { recursive: true });
    await writeFile(join(cwd, item.path, "package.json"), JSON.stringify({
      version,
      private: !["@emseepea/server", "@emseepea/testing"].includes(item.name),
    }));
  }
  const mockRegistry = `
    import assert from 'node:assert/strict';
    globalThis.fetch = async (url) => {
      assert.ok([
        'https://registry.npmjs.org/%40emseepea%2Fserver',
        'https://registry.npmjs.org/%40emseepea%2Ftesting',
      ].includes(url));
      return { ok: true, status: 200, json: async () => ({
        versions: { '0.0.2': {} }, 'dist-tags': { latest: '0.0.0' },
      }) };
    };
  `;
  await exec(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(mockRegistry)}`,
    fileURLToPath(new URL("../../scripts/verify-registry-release.mjs", import.meta.url)),
    "capture", "before.json",
  ], { cwd });
  assert.deepEqual(JSON.parse(await readFile(join(cwd, "before.json"), "utf8")), {
    packages: [
      { name: "@emseepea/server", version: "0.0.3", present: false, latest: "0.0.0" },
      { name: "@emseepea/testing", version: "0.1.0", present: false, latest: "0.0.0" },
    ],
  });
});

test("registry publication detection supports independently versioned packages", () => {
  const before = { packages: [
    { name: "server", present: false },
    { name: "testing", present: false },
  ] };
  assert.equal(classifyPublication(before, { packages: before.packages }), "missing");
  assert.equal(classifyPublication(before, { packages: before.packages.map((item) => ({ ...item, present: true })) }), "published");
  assert.equal(
    classifyPublication(
      { packages: before.packages.map((item) => ({ ...item, present: true })) },
      { packages: before.packages.map((item) => ({ ...item, present: true })) },
    ),
    "unchanged",
  );
  assert.equal(
    classifyPublication(
      { packages: [{ ...before.packages[0], present: true }, before.packages[1]] },
      { packages: before.packages.map((item) => ({ ...item, present: true })) },
    ),
    "published",
  );
  assert.equal(
    classifyPublication(
      { packages: [before.packages[0], { ...before.packages[1], present: true }] },
      { packages: before.packages.map((item) => ({ ...item, present: true })) },
    ),
    "published",
  );
  assert.equal(
    classifyPublication(before, { packages: [{ ...before.packages[0], present: true }, before.packages[1]] }),
    "partial",
  );
});

test("registry publication verification waits for partial registry propagation", async () => {
  const before = { packages: [
    { name: "server", present: false },
    { name: "testing", present: false },
  ] };
  const snapshots = [
    { packages: [{ name: "server", present: true }, { name: "testing", present: false }] },
    { packages: [{ name: "server", present: true }, { name: "testing", present: true }] },
  ];
  assert.deepEqual(await waitForPublication(before, async () => snapshots.shift(), async () => {}), {
    packages: [{ name: "server", present: true }, { name: "testing", present: true }],
  });
});

test("registry publication verification allows three minutes for propagation", async () => {
  const before = { packages: [{ name: "testing", present: false }] };
  let reads = 0;
  await assert.rejects(
    waitForPublication(before, async () => {
      reads += 1;
      return { packages: [{ name: "testing", present: false }] };
    }, async () => {}),
    /not all packages appeared after publication/,
  );
  assert.equal(reads, 60);
});

test("provenance verification waits for attestation propagation", async (t) => {
  const item = { name: "@emseepea/server", attestationsUrl: "https://registry.example/attestations" };
  const statement = { predicateType: "https://slsa.dev/provenance/v1" };
  const provenance = {
    predicateType: statement.predicateType,
    bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") } },
  };
  let calls = 0;
  let waits = 0;
  const request = async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, status: 404 }
      : { ok: true, status: 200, json: async () => ({ attestations: [provenance] }) };
  };

  assert.deepEqual(await readProvenance(item, { request, wait: async () => { waits += 1; } }), statement);
  assert.equal(calls, 2);
  assert.equal(waits, 1);

  await assert.rejects(
    readProvenance(item, {
      request: async () => ({ ok: false, status: 403 }),
      wait: async () => { waits += 1; },
    }),
    /attestations returned 403/,
  );
  assert.equal(waits, 1);

  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ attestations: [provenance] }),
  });
  assert.deepEqual(await Promise.all([item].map(readProvenance)), [statement]);
});

test("registry checks require latest and exact provenance", () => {
  const before = { packages: [{ name: "@emseepea/server", version: "0.0.2", present: false, latest: "0.0.0" }] };
  const after = { packages: [{
    name: "@emseepea/server",
    version: "0.0.2",
    present: true,
    latest: "0.0.2",
    integrity: "sha512-AA==",
    tarball: "https://registry.example/server.tgz",
    attestationsUrl: "https://registry.example/attestations",
    signatures: 1,
  }] };
  assert.doesNotThrow(() => assertRegistryState(before, after));
  assert.throws(
    () => assertRegistryState(before, { packages: [{ ...after.packages[0], present: false }] }),
    /server@0\.0\.2 is missing/,
  );
  assert.throws(
    () => assertRegistryState(before, { packages: [{ ...after.packages[0], latest: "0.0.0" }] }),
    /latest tag is wrong/,
  );

  const expected = {
    ref: "refs/heads/main",
    repository: "https://github.com/emseepea/emseepea",
    // ADR-0098: the publishing workflow is the release build, which keeps the
    // `release.yml` name so the npm trusted publishers stay valid.
    workflowPath: ".github/workflows/release.yml",
    sha: "abc123",
    invocationPrefix: "https://github.com/emseepea/emseepea/actions/runs/42/",
    subject: "pkg:npm/%40emseepea/server@0.0.2",
    sha512: "00",
  };
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ name: expected.subject, digest: { sha512: "00" } }],
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: {
          ref: expected.ref,
          repository: expected.repository,
          path: expected.workflowPath,
        } },
        resolvedDependencies: [{ digest: { gitCommit: expected.sha } }],
      },
      runDetails: { metadata: { invocationId: `${expected.invocationPrefix}attempts/1` } },
    },
  };
  assert.doesNotThrow(() => assertProvenance(statement, expected));
  assert.equal(provenanceIncludesCommit(statement, expected.sha), true);
  assert.equal(provenanceIncludesCommit(statement, "wrong"), false);
  assert.equal(provenanceCommit(statement), expected.sha);
  assert.throws(() => provenanceCommit({ ...statement, predicate: {} }), /exactly one release commit/);
  assert.throws(
    () => assertProvenance(statement, { ...expected, sha: "wrong" }),
    /does not bind the release commit/,
  );
});
