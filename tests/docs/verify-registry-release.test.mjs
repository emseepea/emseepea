import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRegistryState,
  assertStatements,
  classifyPublication,
} from "../../scripts/verify-registry-release.mjs";

// ADR-0098 publishes under `next` at the release pull request and moves the tag
// to `latest` on merge. The same verifier runs at both points and must expect a
// different tag each time, so a promotion check cannot pass a preview and a
// preview check cannot pass a stale `latest`.
const before = { packages: [{ name: "@emseepea/server", version: "1.1.0", present: false, latest: "1.0.0" }] };
const published = (tags) => ({ packages: [{
  name: "@emseepea/server",
  version: "1.1.0",
  present: true,
  tags,
  integrity: `sha512-${"a".repeat(86)}=`,
  tarball: "https://registry.npmjs.org/x.tgz",
  attestationsUrl: "https://registry.npmjs.org/-/npm/v1/attestations/x",
  signatures: 1,
}] });

test("a next publish is verified against the next tag, not latest", () => {
  const after = published({ latest: "1.0.0", next: "1.1.0" });
  assert.doesNotThrow(() => assertRegistryState(before, after, { tag: "next" }));
  // The same state must NOT satisfy a promotion check: latest is still the
  // previous release, which is the whole point of publishing under next first.
  assert.throws(() => assertRegistryState(before, after, { tag: "latest" }), /latest tag/);
});

test("a next publish checks unchanged packages on latest, including a retry", () => {
  const candidate = published({ latest: "1.0.0", next: "1.1.0" }).packages[0];
  const unchanged = {
    ...candidate,
    name: "@emseepea/tailwind",
    version: "0.1.0",
    tags: { latest: "0.1.0", next: "0.0.1" },
  };
  const expected = { packages: [
    { ...before.packages[0], present: true },
    { name: unchanged.name, version: unchanged.version, present: true, latest: "0.1.0" },
  ] };
  const actual = { packages: [candidate, unchanged] };
  assert.doesNotThrow(() => assertRegistryState(expected, actual, { tag: "next" }));
  assert.throws(
    () => assertRegistryState(expected, { packages: [{ ...candidate, tags: { latest: "1.0.0", next: "1.0.0" } }, unchanged] }, { tag: "next" }),
    /server next tag/,
  );
  assert.throws(
    () => assertRegistryState(expected, { packages: [candidate, { ...unchanged, tags: { latest: "0.0.1", next: "0.0.1" } }] }, { tag: "next" }),
    /tailwind latest tag/,
  );
});

test("a promotion is verified against the latest tag", () => {
  const after = published({ latest: "1.1.0", next: "1.1.0" });
  assert.doesNotThrow(() => assertRegistryState(before, after, { tag: "latest" }));
});

test("the tag defaults to latest so an unqualified check stays strict", () => {
  assert.throws(
    () => assertRegistryState(before, published({ latest: "1.0.0", next: "1.1.0" })),
    /latest tag/,
  );
});

test("a promotion that leaves a package behind is rejected", () => {
  const after = {
    packages: [
      ...published({ latest: "1.1.0", next: "1.1.0" }).packages,
      { ...published({ latest: "1.0.0", next: "1.1.0" }).packages[0], name: "@emseepea/feedback" },
    ],
  };
  const twoBefore = { packages: [
    ...before.packages,
    { name: "@emseepea/feedback", version: "1.1.0", present: false, latest: "1.0.0" },
  ] };
  assert.throws(() => assertRegistryState(twoBefore, after, { tag: "latest" }), /latest tag/);
});

test("publication classification still keys on presence, which promotion does not change", () => {
  assert.equal(classifyPublication(before, published({ latest: "1.0.0", next: "1.1.0" })), "published");
  // At promotion time the packages are already present, so there is nothing to
  // wait for -- the tag move is what has to be checked instead.
  assert.equal(
    classifyPublication({ packages: [{ ...before.packages[0], present: true }] }, published({ latest: "1.1.0" })),
    "unchanged",
  );
});

test("provenance preserves a historical already-latest package but binds fresh versions to the release run", () => {
  const releaseSha = "b".repeat(40);
  const historicalSha = "a".repeat(40);
  const repository = "https://github.com/emseepea/emseepea";
  const workflowPath = ".github/workflows/release.yml";
  const invocationPrefix = `${repository}/actions/runs/`;
  const integrity = `sha512-${Buffer.alloc(64, 1).toString("base64")}`;
  const subject = (name, version) => `pkg:npm/${encodeURIComponent(name).replace("%2F", "/")}@${version}`;
  const statement = (name, version, sha, ref, runId) => ({
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { ref, repository, path: workflowPath } },
        resolvedDependencies: [{ digest: { gitCommit: sha } }],
      },
      runDetails: { metadata: { invocationId: `${invocationPrefix}${runId}/attempts/1` } },
    },
    subject: [{ name: subject(name, version), digest: { sha512: Buffer.alloc(64, 1).toString("hex") } }],
  });
  const prior = { packages: [
    { name: "@emseepea/server", version: "1.1.0", present: false, latest: "1.0.0" },
    { name: "@emseepea/tailwind", version: "0.1.0", present: true, latest: "0.1.0" },
  ] };
  const after = { packages: prior.packages.map((item) => ({ ...item, present: true, integrity })) };
  const fresh = statement("@emseepea/server", "1.1.0", releaseSha, "refs/heads/changeset-release/publish", "123");
  const historical = statement("@emseepea/tailwind", "0.1.0", historicalSha, "refs/heads/main", "99");
  const context = {
    releaseSha,
    releaseRunId: "123",
    changedPackages: new Set(["@emseepea/server"]),
    ancestorCommits: new Set([historicalSha]),
    repository,
    workflowPath,
    invocationPrefix,
  };
  assert.doesNotThrow(() => assertStatements(prior, after, [fresh, historical], context));
  assert.throws(() => assertStatements(prior, after, [
    statement("@emseepea/server", "1.1.0", historicalSha, "refs/heads/main", "99"), historical,
  ], context), /release commit/);
  assert.throws(() => assertStatements(prior, after, [
    statement("@emseepea/server", "1.1.0", releaseSha, "refs/heads/changeset-release/publish", "999"), historical,
  ], context), /release workflow run/);
  assert.throws(() => assertStatements(prior, after, [
    statement("@emseepea/server", "1.1.0", releaseSha, "refs/heads/main", "123"), historical,
  ], context), /ref/);
  assert.throws(() => assertStatements(prior, after, [fresh, historical], {
    ...context, ancestorCommits: new Set(),
  }), /ancestor/);
  assert.throws(() => assertStatements(prior, after, [fresh, {
    ...historical,
    predicate: {
      ...historical.predicate,
      buildDefinition: {
        ...historical.predicate.buildDefinition,
        externalParameters: { workflow: { ref: "refs/heads/main", repository: "https://github.com/other/repo", path: workflowPath } },
      },
    },
  }], context), /repository/);
  assert.throws(() => assertStatements(prior, after, [fresh, historical], {
    ...context, changedPackages: new Set(["@emseepea/server", "@emseepea/tailwind"]),
  }), /release commit/);
  assert.throws(() => assertStatements(prior, after, [fresh, historical], {
    ...context, releaseRunId: undefined,
  }), /release run ID/);
  assert.throws(() => assertStatements({ packages: [prior.packages[0], { ...prior.packages[1], latest: "0.0.1" }] }, after, [fresh, historical], context), /already on latest/);
});
