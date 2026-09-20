import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRegistryState,
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
