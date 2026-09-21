import assert from "node:assert/strict";
import test from "node:test";

import { promoteRelease } from "../../scripts/promote-release.mjs";

// ADR-0098: merging the release pull request promotes rather than publishes.
// Nothing is rebuilt and nothing is republished, so the tarballs on `latest`
// are the ones the release pull request built and checked.
const packages = [
  { name: "@emseepea/server", version: "1.1.0" },
  { name: "@emseepea/feedback", version: "0.4.0" },
];

test("promotion moves each package's latest tag to the version already on next", async () => {
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args].join(" "));
    if (args[0] === "view") return "1.1.0";
    return "";
  };
  await promoteRelease({
    packages,
    run,
    readNextTag: async (name) => (name === "@emseepea/server" ? "1.1.0" : "0.4.0"),
  });
  assert.deepEqual(calls, [
    "npm dist-tag add @emseepea/server@1.1.0 latest --userconfig /dev/null",
    "npm dist-tag add @emseepea/feedback@0.4.0 latest --userconfig /dev/null",
  ]);
});

test("promotion refuses a version that is not already on next", async () => {
  // Promoting a version the release pull request never published would put
  // bytes on `latest` that no check ever saw.
  await assert.rejects(
    () => promoteRelease({
      packages,
      run: async () => "",
      readNextTag: async (name) => (name === "@emseepea/server" ? "1.1.0" : "0.3.0"),
    }),
    /@emseepea\/feedback/,
  );
});

test("promotion refuses a missing next tag before moving any latest tag", async () => {
  const calls = [];
  await assert.rejects(
    () => promoteRelease({
      packages,
      run: async (command, args) => { calls.push([command, ...args].join(" ")); return ""; },
      readNextTag: async (name) => (name === "@emseepea/server" ? "1.1.0" : undefined),
    }),
    /@emseepea\/feedback.*next/,
  );
  assert.deepEqual(calls, []);
});

test("promotion refuses an unreadable next tag before moving any latest tag", async () => {
  const calls = [];
  await assert.rejects(
    () => promoteRelease({
      packages,
      run: async (command, args) => {
        calls.push([command, ...args].join(" "));
        if (args[0] === "view" && args[1] === "@emseepea/feedback@next") throw new Error("registry unavailable");
        return args[1] === "@emseepea/server@next" ? "1.1.0" : "";
      },
    }),
    /@emseepea\/feedback.*next/,
  );
  assert.deepEqual(calls, [
    "npm view @emseepea/server@next version --userconfig /dev/null",
    "npm view @emseepea/feedback@next version --userconfig /dev/null",
  ]);
});

test("promotion is idempotent when a tag already points at the version", async () => {
  const calls = [];
  await promoteRelease({
    packages,
    run: async (command, args) => { calls.push(args.join(" ")); return ""; },
    readNextTag: async (name) => (name === "@emseepea/server" ? "1.1.0" : "0.4.0"),
    readLatestTag: async (name) => (name === "@emseepea/server" ? "1.1.0" : "0.3.0"),
  });
  // The server is already promoted, so only the feedback package moves.
  assert.deepEqual(calls, ["dist-tag add @emseepea/feedback@0.4.0 latest --userconfig /dev/null"]);
});

test("an unchanged package already on latest does not need the next tag", async () => {
  const calls = [];
  await promoteRelease({
    packages: [
      { name: "@emseepea/tailwind", version: "0.1.0" },
      { name: "@emseepea/server", version: "1.1.0" },
    ],
    run: async (command, args) => { calls.push([command, ...args].join(" ")); return ""; },
    readNextTag: async (name) => name === "@emseepea/tailwind" ? "0.0.1" : "1.1.0",
    readLatestTag: async (name) => name === "@emseepea/tailwind" ? "0.1.0" : "1.0.0",
    changedPackages: new Set(["@emseepea/server"]),
  });
  assert.deepEqual(calls, ["npm dist-tag add @emseepea/server@1.1.0 latest --userconfig /dev/null"]);
});

test("a freshly released version still needs next after a partial promotion", async () => {
  await assert.rejects(() => promoteRelease({
    packages: [{ name: "@emseepea/server", version: "1.1.0" }],
    run: async () => "",
    readNextTag: async () => "1.0.0",
    readLatestTag: async () => "1.1.0",
    changedPackages: new Set(["@emseepea/server"]),
  }), /server.*next/);
});
