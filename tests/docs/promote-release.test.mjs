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
  await promoteRelease({ packages, run, readNextTag: async () => undefined });
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
