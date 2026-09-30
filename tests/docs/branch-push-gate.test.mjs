import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const gateSource = join(projectRoot, "scripts/branch-push-gate.mjs");
const hookSource = join(projectRoot, ".githooks/pre-push");
const zeroOid = "0".repeat(40);

async function run(command, args, { cwd, env, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { cwd, env, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.stdin.end(input);
  });
}

async function git(cwd, ...args) {
  return (await run("git", args, { cwd })).stdout.trim();
}

async function makeRepository(t) {
  const root = await mkdtemp(join(tmpdir(), "emseepea-push-gate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repository = join(root, "repository");
  const bin = join(root, "bin");
  await mkdir(join(repository, "scripts"), { recursive: true });
  await mkdir(join(repository, ".githooks"), { recursive: true });
  await mkdir(bin);
  await copyFile(gateSource, join(repository, "scripts/branch-push-gate.mjs"));
  await copyFile(hookSource, join(repository, ".githooks/pre-push"));
  await chmod(join(repository, ".githooks/pre-push"), 0o755);
  await writeFile(join(repository, "package.json"), JSON.stringify({
    private: true,
    type: "module",
    scripts: {
      "hooks:install": "node scripts/branch-push-gate.mjs install",
      "push:qualify": "node scripts/branch-push-gate.mjs qualify",
    },
  }));
  await writeFile(join(bin, "npm"), `#!/bin/sh
printf '%s\\n' "$*" >> "$NPM_CALLS"
if [ "$NPM_ADVANCE" = "$1" ]; then git commit --allow-empty -m advance >/dev/null; fi
if [ "$NPM_DIRTY" = "$1" ]; then printf dirty > "$NPM_REPOSITORY/dirty"; fi
if [ "$NPM_FAIL" = "$1" ]; then exit 42; fi
`);
  await chmod(join(bin, "npm"), 0o755);
  await git(repository, "init", "-b", "main");
  await git(repository, "config", "user.email", "test@example.com");
  await git(repository, "config", "user.name", "Test");
  await git(repository, "add", ".");
  await git(repository, "commit", "-m", "fixture");
  return { root, repository, bin };
}

function qualificationEnvironment({ root, repository, bin, ...overrides }) {
  return {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    NPM_CALLS: join(root, "npm-calls"),
    NPM_REPOSITORY: repository,
    ...overrides,
  };
}

async function evidencePath(repository, sha) {
  return join(repository, await git(repository, "rev-parse", "--git-path", `emseepea-qualified/${sha}`));
}

async function qualify(fixture, overrides = {}) {
  return run("node", ["scripts/branch-push-gate.mjs", "qualify"], {
    cwd: fixture.repository,
    env: qualificationEnvironment({ ...fixture, ...overrides }),
  });
}

async function checkPush(repository, updates) {
  return run(join(repository, ".githooks/pre-push"), ["origin", "https://example.test/repository.git"], {
    cwd: repository,
    input: `${updates.join("\n")}\n`,
  });
}

test("qualification runs the existing clean-install test contract and records only unchanged clean HEAD", async (t) => {
  for (const [name, overrides, expectedCalls, setup] of [
    ["dirty start", {}, [], async ({ repository }) => writeFile(join(repository, "dirty"), "dirty")],
    ["failed npm ci", { NPM_FAIL: "ci" }, ["ci"], async () => {}],
    ["failed npm test", { NPM_FAIL: "test" }, ["ci", "test"], async () => {}],
    ["changed HEAD", { NPM_ADVANCE: "test" }, ["ci", "test"], async () => {}],
    ["dirty finish", { NPM_DIRTY: "test" }, ["ci", "test"], async () => {}],
  ]) {
    await t.test(name, async (t) => {
      const fixture = await makeRepository(t);
      const sha = await git(fixture.repository, "rev-parse", "HEAD");
      await setup(fixture);
      await assert.rejects(() => qualify(fixture, overrides));
      const calls = await readFile(join(fixture.root, "npm-calls"), "utf8").catch(() => "");
      assert.deepEqual(calls.trim().split("\n").filter(Boolean), expectedCalls);
      const marker = await evidencePath(fixture.repository, sha);
      await assert.rejects(() => stat(marker), { code: "ENOENT" });
    });
  }

  const fixture = await makeRepository(t);
  const sha = await git(fixture.repository, "rev-parse", "HEAD");
  await qualify(fixture);
  assert.equal(await readFile(await evidencePath(fixture.repository, sha), "utf8"), `${sha}\n`);
  assert.deepEqual((await readFile(join(fixture.root, "npm-calls"), "utf8")).trim().split("\n"), ["ci", "test"]);
});

test("pre-push requires exact evidence for every non-deletion outgoing tip", async (t) => {
  const fixture = await makeRepository(t);
  const first = await git(fixture.repository, "rev-parse", "HEAD");
  const firstUpdate = `refs/heads/first ${first} refs/heads/first ${zeroOid}`;
  await assert.rejects(() => checkPush(fixture.repository, [firstUpdate]), /not qualified/);

  await qualify(fixture);
  await git(fixture.repository, "commit", "--allow-empty", "-m", "second");
  const second = await git(fixture.repository, "rev-parse", "HEAD");
  const secondUpdate = `refs/heads/second ${second} refs/heads/second ${zeroOid}`;
  await assert.rejects(() => checkPush(fixture.repository, [firstUpdate, secondUpdate]), new RegExp(second));

  await qualify(fixture);
  await checkPush(fixture.repository, [firstUpdate, secondUpdate]);
  await checkPush(fixture.repository, [`(delete) ${zeroOid} refs/heads/old ${first}`]);
});

test("the tracked hook installs in a fresh clone and worktree", async (t) => {
  const fixture = await makeRepository(t);
  const clone = join(fixture.root, "clone");
  await git(fixture.root, "clone", fixture.repository, clone);
  await run("npm", ["run", "hooks:install"], { cwd: clone });
  assert.equal(await git(clone, "config", "--get", "core.hooksPath"), ".githooks");
  assert.ok((await stat(join(clone, await git(clone, "rev-parse", "--git-path", "hooks/pre-push")))).mode & 0o111);

  const worktree = join(fixture.root, "worktree");
  await git(fixture.repository, "worktree", "add", "-b", "worktree", worktree);
  await run("npm", ["run", "hooks:install"], { cwd: worktree });
  assert.equal(await git(worktree, "config", "--get", "core.hooksPath"), ".githooks");
  assert.ok((await stat(join(worktree, await git(worktree, "rev-parse", "--git-path", "hooks/pre-push")))).mode & 0o111);

  const manifest = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  assert.equal(manifest.scripts["push:qualify"], "node scripts/branch-push-gate.mjs qualify");
  assert.equal(manifest.scripts["hooks:install"], "node scripts/branch-push-gate.mjs install");
});
