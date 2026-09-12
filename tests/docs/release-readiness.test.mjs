import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertPlannedReleaseReadiness,
  assertReleasePullRequestPlan,
  assertReleaseReadiness,
  readPlannedReleaseStatus,
} from "../../scripts/verify-release-readiness.mjs";
import { initializerPackages, publicPackages } from "../../scripts/public-packages.mjs";

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

test("untagged packages drive initializer dependency closure without expanding the readiness batch", () => {
  const untaggedReleases = [
    { name: "@emseepea/server", newVersion: "0.10.1" },
    { name: "@emseepea/feedback", newVersion: "0.2.7" },
    { name: "@emseepea/testing", newVersion: "0.9.11" },
    { name: "@emseepea/react", newVersion: "0.0.20" },
  ];
  const releases = initializerPackages.map(({ name }, index) => ({
    name,
    type: "patch",
    newVersion: `0.0.${index + 1}`,
  }));
  const initializers = initializerPackages.map(({ name }) => ({
    name,
    starterDependencies: [{ name: "@emseepea/server", version: "0.10.1" }],
  }));
  const review = `${releases
    .map(({ name, newVersion }) => `- \`${name}@${newVersion}\``)
    .join("\n")}

- Result: PASS
- Final result: within appetite.
`;
  const status = { releases, untaggedReleases, initializers };
  assert.doesNotThrow(() => assertPlannedReleaseReadiness(status, review));
  assert.throws(
    () => assertPlannedReleaseReadiness({ ...status, releases: releases.slice(1) }, review),
    /must be released with its updated starter dependencies/,
  );
  assert.throws(
    () => assertPlannedReleaseReadiness(
      status,
      `- \`@emseepea/feedback@0.2.7\`\n${review}`,
    ),
    /package set/,
  );
  assert.throws(
    () => assertPlannedReleaseReadiness({
      ...status,
      initializers: initializers.map((initializer, index) => index === 0
        ? { ...initializer, starterDependencies: [{ name: "@emseepea/server", version: "0.10.0" }] }
        : initializer),
    }, review),
    /stale @emseepea\/server starter dependency/,
  );
});

test("planned status trusts the exact origin tag inventory", async () => {
  const server = publicPackages.find(({ name }) => name === "@emseepea/server");
  const serverVersion = JSON.parse(await readFile(
    new URL(`../../${server.path}/package.json`, import.meta.url),
    "utf8",
  )).version;
  const calls = [];
  const status = await readPlannedReleaseStatus(process.cwd(), async (command, args) => {
    calls.push([command, ...args]);
    return { stdout: `${"a".repeat(40)}\trefs/tags/${server.name}@${serverVersion}\n` };
  });
  assert.deepEqual(calls, [["git", "ls-remote", "--tags", "--refs", "origin"]]);
  assert.equal(status.untaggedReleases.some(({ name }) => name === server.name), false);
  assert.equal(status.untaggedReleases.some(({ name }) => name === "@emseepea/tailwind"), true);
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

  const initializerStatus = {
    releases: [
      ...status.releases,
      { name: "@emseepea/create-tool-server", type: "patch", newVersion: "0.0.2" },
    ],
    initializers: [{
      name: "@emseepea/create-tool-server",
      starterDependencies: [{ name: "@emseepea/server", version: "1.0.0" }],
    }],
  };
  const initializerBaseLock = { packages: {
    ...baseLock.packages,
    "examples/tool-server": { name: "@emseepea/create-tool-server", version: "0.0.1" },
  } };
  const initializerHeadLock = { packages: {
    ...headLock.packages,
    "examples/tool-server": { name: "@emseepea/create-tool-server", version: "0.0.2" },
  } };
  const initializerManifests = [
    {
      base: { name: "@emseepea/server", version: "1.0.0" },
      head: { name: "@emseepea/server", version: "1.0.1" },
    },
    {
      base: { name: "@emseepea/create-tool-server", version: "0.0.1" },
      head: {
        name: "@emseepea/create-tool-server",
        version: "0.0.2",
        starterDependencies: ["@emseepea/server"],
        devDependencies: { "@emseepea/server": "1.0.1" },
      },
    },
  ];
  const initializerFiles = [
    "package-lock.json",
    "packages/server/package.json",
    "examples/tool-server/package.json",
  ];
  assert.doesNotThrow(() => assertReleasePullRequestPlan(
    initializerStatus,
    initializerBaseLock,
    initializerHeadLock,
    initializerFiles,
    initializerManifests,
  ));
  assert.throws(
    () => assertReleasePullRequestPlan(
      initializerStatus,
      initializerBaseLock,
      initializerHeadLock,
      initializerFiles,
      initializerManifests.map(({ base, head }) => ({
        base,
        head: head.name === "@emseepea/create-tool-server"
          ? { ...head, devDependencies: { "@emseepea/server": "1.0.0" } }
          : head,
      })),
    ),
    /stale @emseepea\/server starter dependency/,
  );
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
