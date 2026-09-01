import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { assertPackedTargets } from "../../scripts/verify-packed-package.mjs";
import {
  assertProvenance,
  assertRegistryState,
  classifyPublication,
  classifyRecovery,
  provenanceIncludesCommit,
} from "../../scripts/verify-registry-release.mjs";

const workflow = await readFile(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");
const quality = await readFile(new URL("../../.github/workflows/quality.yml", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const serverManifest = JSON.parse(await readFile(new URL("../../packages/framework/package.json", import.meta.url), "utf8"));
const testingManifest = JSON.parse(await readFile(new URL("../../packages/testing/package.json", import.meta.url), "utf8"));
const installedSmoke = await readFile(new URL("../../scripts/verify-installed-package.mjs", import.meta.url), "utf8");
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

test("the Claude subscription check runs only for the publication revision", () => {
  assert.match(
    workflow,
    /- name: Check whether a language model understands every example\n\s+if: steps\.release-state\.outputs\.has_changesets == 'false'\n\s+env:\n\s+CLAUDE_CODE_OAUTH_TOKEN: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}\n\s+run: npm run test:eval:ci/,
  );
  assert.match(
    workflow,
    /- name: Upload redacted language-model evidence\n\s+if: \$\{\{ always\(\) && steps\.release-state\.outputs\.has_changesets == 'false' \}\}[\s\S]*retention-days: 14/,
  );
  assert.doesNotMatch(
    workflow,
    /copilot-requests|EMSEEPEA_COPILOT|@github\/copilot/,
  );
  const job = workflow.match(/  semantic-eval:[\s\S]*?\n  changesets:/)?.[0] ?? "";
  assert.match(job, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(job, /contents: write|id-token: write|pull-requests: write|checks: write/);
  assert.equal((job.match(/CLAUDE_CODE_OAUTH_TOKEN/g) ?? []).length, 2);
  assert.equal(manifest.scripts["claude:prepare"], "node node_modules/@anthropic-ai/claude-code/install.cjs");
  const prepare = job.match(/- name: Prepare the pinned Claude CLI[\s\S]*?(?=\n\s+- name:)/)?.[0] ?? "";
  assert.match(prepare, /if: steps\.release-state\.outputs\.has_changesets == 'false'/);
  assert.match(prepare, /2\.1\.248/);
  assert.equal((prepare.match(/npm run claude:prepare/g) ?? []).length, 2);
  assert.match(prepare, /test -x node_modules\/\.bin\/claude/);
  assert.match(prepare, /realpath node_modules\/\.bin\/claude/);
  assert.doesNotMatch(prepare, /CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY/);
  assert.ok(job.indexOf("npm ci --ignore-scripts") < job.indexOf("Prepare the pinned Claude CLI"));
  assert.ok(job.indexOf("Prepare the pinned Claude CLI") < job.indexOf("Check whether a language model understands every example"));
});

test("release preparation and publication do not run when release state is unknown", () => {
  assert.match(
    workflow,
    /needs\.semantic-eval\.outputs\.has_changesets == 'true' \|\| \(needs\.semantic-eval\.outputs\.has_changesets == 'false' && needs\.semantic-eval\.result == 'success'\)/,
  );
  assert.doesNotMatch(
    workflow,
    /needs\.semantic-eval\.outputs\.has_changesets == 'true' \|\| needs\.semantic-eval\.result == 'success'/,
  );
});

test("versioning refreshes the lockfile", () => {
  assert.equal(
    manifest.scripts["version-packages"],
    "changeset version && npm install --package-lock-only --ignore-scripts",
  );
});

test("publication evidence covers both public packages", () => {
  assert.match(workflow, /npm pack --workspace @emseepea\/server/);
  assert.match(workflow, /npm pack --workspace @emseepea\/testing/);
  assert.match(workflow, /npm sbom --workspace @emseepea\/server/);
  assert.match(workflow, /npm sbom --workspace @emseepea\/testing/);
  assert.match(workflow, /@emseepea\/testing@\$testing_version/);
  assert.match(workflow, /verify-registry-release\.mjs capture/);
  assert.match(workflow, /verify-registry-release\.mjs verify/);
  assert.match(workflow, /verify-packed-package\.mjs packages\/framework\/package\.json/);
  assert.match(workflow, /verify-packed-package\.mjs packages\/testing\/package\.json/);
  assert.match(workflow, /@emseepea\/testing registry integrity/);
  assert.match(workflow, /@emseepea\/server@\$server_version/);
  assert.match(workflow, /release-artifacts\/server-sbom\.cdx\.json/);
  assert.match(workflow, /release-artifacts\/testing-sbom\.cdx\.json/);
  assert.doesNotMatch(workflow, /@emseepea\/server@\$version/);
  assert.doesNotMatch(workflow, /release-artifacts\/sbom\.cdx\.json/);
});

test("publication builds and verifies packages before creating public releases", () => {
  const job = workflow.match(/  changesets:[\s\S]*/)?.[0] ?? "";
  assert.ok(job.indexOf("npm ci --ignore-scripts") < job.indexOf("Build packages for publication"));
  assert.ok(job.indexOf("Build packages for publication") < job.indexOf("npm pack --workspace @emseepea/server"));
  assert.ok(job.indexOf("npm pack --workspace @emseepea/server") < job.indexOf("changesets/action@"));
  assert.ok(job.indexOf("verify-registry-release.mjs verify") < job.indexOf("npm audit signatures"));
  assert.ok(job.indexOf("npm audit --audit-level=high --userconfig /dev/null") < job.indexOf("npm audit signatures"));
  assert.ok(job.indexOf("npm audit signatures") < job.indexOf("gh release create"));
  assert.match(job, /createGithubReleases: false/);
  assert.match(job, /if: steps\.registry-verify\.outputs\.published == 'true'/);
  assert.match(job, /EMSEEPEA_GUIDE_PACKAGE_SOURCE=registry node --test tests\/docs\/getting-started-references\.test\.mjs/);
  assert.ok(job.indexOf("verify-registry-release.mjs verify") < job.indexOf("EMSEEPEA_GUIDE_PACKAGE_SOURCE=registry"));
  assert.match(job, /remote_tag_target\(\)/);
  assert.match(job, /gh release edit/);
  assert.match(job, /gh release create "\$tag" --draft/);
  assert.match(job, /gh release edit "\$tag" --draft=false/);
  assert.match(job, /gh release view "\$tag" --json assets/);
  assert.match(job, /gh release view "\$tag" --json isDraft/);
  assert.match(job, /gh release upload "\$tag" "\$@" --clobber/);
  assert.match(job, /--latest=false/);
  assert.doesNotMatch(job, /steps\.changesets\.outputs\.published/);
});

test("the installed-package smoke uses distinct fixed and template resource routes", async () => {
  assert.match(installedSmoke, /const resourceUri = "smoke:\/\/static\/value"/);
  assert.match(installedSmoke, /uriTemplate: "smoke:\/\/resource\/\{value\}"/);
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
  for (const [directory, version] of [["framework", "0.0.3"], ["testing", "0.1.0"]]) {
    await mkdir(join(cwd, "packages", directory), { recursive: true });
    await writeFile(join(cwd, "packages", directory, "package.json"), JSON.stringify({ version }));
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

test("registry publication detection fails on partial publication", () => {
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
  assert.throws(
    () => classifyPublication(before, { packages: [{ ...before.packages[0], present: true }, before.packages[1]] }),
    /only one package was published/,
  );
  assert.throws(
    () => classifyPublication(
      { packages: [{ ...before.packages[0], present: true }, before.packages[1]] },
      { packages: before.packages },
    ),
    /only one package version existed before publication/,
  );
});

test("registry checks preserve tags and exact provenance", () => {
  const before = { packages: [{ name: "@emseepea/server", version: "0.0.2", present: false, latest: "0.0.0" }] };
  const after = { packages: [{
    name: "@emseepea/server",
    version: "0.0.2",
    present: true,
    latest: "0.0.0",
    next: "0.0.2",
    integrity: "sha512-AA==",
    tarball: "https://registry.example/server.tgz",
    attestationsUrl: "https://registry.example/attestations",
    signatures: 1,
  }] };
  assert.doesNotThrow(() => assertRegistryState(before, after));
  assert.throws(
    () => assertRegistryState(before, { packages: [{ ...after.packages[0], latest: "0.0.2" }] }),
    /latest tag changed/,
  );
  assert.throws(
    () => assertRegistryState(
      { packages: [{ ...before.packages[0], latest: "0.0.2" }] },
      { packages: [{ ...after.packages[0], latest: "0.0.2" }] },
    ),
    /latest tag points to the pre-alpha release/,
  );

  const expected = {
    ref: "refs/heads/main",
    repository: "https://github.com/windyroad/emseepea",
    workflowPath: ".github/workflows/release.yml",
    sha: "abc123",
    invocationPrefix: "https://github.com/windyroad/emseepea/actions/runs/42/",
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
  assert.equal(classifyRecovery([statement, statement], expected.sha), "recovery");
  assert.equal(classifyRecovery([statement, statement], "wrong"), "unrelated");
  assert.throws(
    () => classifyRecovery([statement, { ...statement, predicate: {} }], expected.sha),
    /only one package has provenance/,
  );
  assert.throws(
    () => assertProvenance(statement, { ...expected, sha: "wrong" }),
    /does not bind the release commit/,
  );
});
