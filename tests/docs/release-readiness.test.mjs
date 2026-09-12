import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPlannedReleaseReadiness,
  assertReleasePullRequestPlan,
  assertReleaseReadiness,
} from "../../scripts/verify-release-readiness.mjs";
import { initializerPackages } from "../../scripts/public-packages.mjs";

const registry = { packages: [
  { name: "@emseepea/server", version: "1.0.0", present: true },
  { name: "@emseepea/create-example", version: "0.0.1", present: false },
] };
const review = `
- \`@emseepea/create-example@0.0.1\`

- Result: PASS
- Final result: within appetite.
`;
const retryReview = `
- \`@emseepea/server@1.0.0\`
- \`@emseepea/create-example@0.0.1\`

- Result: PASS
- Final result: within appetite.
`;

test("release readiness covers every unpublished package", () => {
  assert.doesNotThrow(() => assertReleaseReadiness(registry, review));
  assert.doesNotThrow(() => assertReleaseReadiness(registry, review.replace(
    "within appetite.",
    "within appetite, subject to the required exact-commit gates.",
  )));
  assert.doesNotThrow(() => assertReleaseReadiness(registry, retryReview));
  assert.doesNotThrow(() => assertReleaseReadiness({ packages: [] }, ""));
  assert.throws(
    () => assertReleaseReadiness(registry, retryReview.replace("- `@emseepea/create-example@0.0.1`\n", "")),
    /package set/,
  );
  assert.throws(
    () => assertReleaseReadiness(registry, retryReview.replace(
      "- `@emseepea/server@1.0.0`",
      "- `@emseepea/server@1.0.0`\n- `@emseepea/not-a-target@9.9.9`",
    )),
    /package set/,
  );
  assert.throws(() => assertReleaseReadiness(registry, review.replace("0.0.1", "0.0.2")), /package set/);
  assert.throws(() => assertReleaseReadiness(registry, review.replace("PASS", "PENDING")), /Result: PASS/);
  assert.throws(() => assertReleaseReadiness(registry, review.replace("within appetite", "pending")), /within appetite/);
  assert.throws(() => assertReleaseReadiness(registry, review.replace(
    "within appetite.",
    "within appetite, except for future checks.",
  )), /within appetite/);
});

test("release readiness covers every package planned by Changesets", () => {
  const status = { releases: [
    { name: "@emseepea/server", type: "patch", newVersion: "1.0.1" },
    { name: "@emseepea/feedback", type: "patch", newVersion: "0.2.7" },
    { name: "@emseepea/example", type: "none", newVersion: "0.0.1" },
  ] };
  const plannedReview = `
- \`@emseepea/server@1.0.1\`
- \`@emseepea/feedback@0.2.7\`

- Result: PASS
- Final result: within appetite.
`;
  assert.doesNotThrow(() => assertPlannedReleaseReadiness(status, plannedReview));
  assert.throws(
    () => assertPlannedReleaseReadiness(status, plannedReview.replace("1.0.1", "1.0.2")),
    /package set/,
  );
  assert.throws(
    () => assertPlannedReleaseReadiness({ releases: [] }, "", { requireReleases: true }),
    /no planned releases/,
  );
});

test("release readiness binds the Changesets plan to the release pull request", () => {
  const status = { releases: [{ name: "@emseepea/server", type: "patch", newVersion: "1.0.1" }] };
  const baseLock = { packages: { "packages/server": { name: "@emseepea/server", version: "1.0.0" } } };
  const headLock = { packages: { "packages/server": { name: "@emseepea/server", version: "1.0.1" } } };
  assert.doesNotThrow(() => assertReleasePullRequestPlan(
    status,
    baseLock,
    headLock,
    ["package-lock.json", "packages/server/package.json", "packages/server/CHANGELOG.md"],
    [{
      base: { name: "@emseepea/server", version: "1.0.0" },
      head: { name: "@emseepea/server", version: "1.0.1" },
    }],
  ));
  assert.throws(
    () => assertReleasePullRequestPlan(status, baseLock, headLock, ["packages/server/src/index.ts"], []),
    /non-generated files/,
  );
  assert.throws(
    () => assertReleasePullRequestPlan(
      status,
      baseLock,
      headLock,
      ["package-lock.json", "packages/server/package.json"],
      [{
        base: { name: "@emseepea/server", version: "1.0.0" },
        head: { name: "@emseepea/server", version: "9.0.0" },
      }],
    ),
    /manifests do not match/,
  );

  const websiteStatus = { releases: [{ name: "@emseepea/website", type: "patch", newVersion: "0.0.2" }] };
  const websiteBase = { packages: { website: { name: "@emseepea/website", version: "0.0.1" } } };
  const websiteHead = { packages: { website: { name: "@emseepea/website", version: "0.0.2" } } };
  assert.doesNotThrow(() => assertReleasePullRequestPlan(
    websiteStatus,
    websiteBase,
    websiteHead,
    ["package-lock.json", "website/package.json", "website/CHANGELOG.md"],
    [{
      base: { name: "@emseepea/website", version: "0.0.1" },
      head: { name: "@emseepea/website", version: "0.0.2" },
    }],
  ));
});

test("release readiness requires every changed published initializer in the Changesets plan", () => {
  for (const { name } of initializerPackages) {
    assert.doesNotThrow(() => assertReleasePullRequestPlan(
      { releases: [{ name, type: "patch", newVersion: "1.0.1" }] },
      { packages: { initializer: { name, version: "1.0.0" } } },
      { packages: { initializer: { name, version: "1.0.1" } } },
      [],
      [{
        base: { name, version: "1.0.0", description: "before" },
        head: { name, version: "1.0.1", description: "after" },
      }],
    ));
    assert.throws(
      () => assertReleasePullRequestPlan(
        { releases: [] },
        { packages: {} },
        { packages: {} },
        [],
        [{
          base: { name, version: "1.0.0", description: "before" },
          head: { name, version: "1.0.0", description: "after" },
        }],
      ),
      /initializer manifest without a planned release/,
      name,
    );
  }
});
