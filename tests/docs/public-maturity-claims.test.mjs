import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const checker = path.join(root, "scripts/check-public-claims.mjs");
const boundary = "Em See Pea is beta. [Maturity and support](SUPPORT.md#maturity-and-support).";
const support = `## Maturity and support\nEm See Pea is beta. Named capabilities are verified end to end. Versions below 1.0 may introduce breaking changes. Only the newest version under npm latest is eligible for security fixes. There is no production-support promise, no backport promise, and no response-time promise.`;
const homepage = `## Maturity and support\nEm See Pea is beta. Named capabilities are verified end to end. Versions below 1.0 may introduce breaking changes. Only the newest version under npm latest is eligible for security fixes. There is no production-support promise, no backport promise, and no response-time promise. MCP 2026-07-28 over Streamable HTTP. Compatible 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07: initialization, tool listing, tool invocation. No list-change notifications or generic extension-notification registration point. Sampling absent. See protocol-coverage.md. Node.js 22 or newer; four starters need 22.13.0. CI tests Node.js 22 and 24.`;

function check(directory = root) {
  return spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
}

test("public-claims build guard accepts bounded copy and rejects bare beta and missing coverage", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "emseepea-claims-"));
  try {
    await mkdir(path.join(fixture, "packages/server"), { recursive: true });
    await mkdir(path.join(fixture, "examples"));
    await mkdir(path.join(fixture, "website/src/content/docs"), { recursive: true });
    for (const file of ["README.md", "SECURITY.md", "CONTRIBUTING.md", "RISK-POLICY.md"]) {
      await writeFile(path.join(fixture, file), boundary);
    }
    await writeFile(path.join(fixture, "SUPPORT.md"), support);
    await writeFile(path.join(fixture, "website/src/content/docs/index.md"), homepage);
    await writeFile(path.join(fixture, "packages/server/package.json"), JSON.stringify({ name: "@emseepea/server" }));
    await writeFile(path.join(fixture, "packages/server/README.md"), boundary);
    for (const starter of ["database-schema-server", "mongodb-backed-server", "multi-instance-postgres-server", "soap-backed-server"]) {
      await mkdir(path.join(fixture, `examples/${starter}`));
      await writeFile(path.join(fixture, `examples/${starter}/README.md`), "You need Node.js 22.13.0 or newer.");
    }

    assert.equal(check(fixture).status, 0);
    await writeFile(path.join(fixture, "packages/server/README.md"), "This package is beta.");
    const bare = check(fixture);
    assert.equal(bare.status, 1);
    assert.match(bare.stderr, /beta needs a direct link/);

    await writeFile(path.join(fixture, "packages/server/README.md"), `This package is beta.\n\n${boundary}`);
    const distantLink = check(fixture);
    assert.equal(distantLink.status, 1);
    assert.match(distantLink.stderr, /beta needs a direct link/);

    await writeFile(path.join(fixture, "packages/server/README.md"), boundary);
    await writeFile(path.join(fixture, "website/src/content/docs/index.md"), homepage.replace("no response-time promise", "no response times"));
    const unboundedHome = check(fixture);
    assert.equal(unboundedHome.status, 1);
    assert.match(unboundedHome.stderr, /missing approved beta limit/);

    await writeFile(path.join(fixture, "website/src/content/docs/index.md"), "Em See Pea is beta.");
    const vague = check(fixture);
    assert.equal(vague.status, 1);
    assert.match(vague.stderr, /missing approved claim/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("the current published guidance passes the build guard", () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
});
