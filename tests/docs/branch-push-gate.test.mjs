import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";
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
  await mkdir(join(repository, "tests/docs"), { recursive: true });
  await mkdir(bin);
  await copyFile(gateSource, join(repository, "scripts/branch-push-gate.mjs"));
  await copyFile(join(projectRoot, "scripts/docs-only-changes.mjs"), join(repository, "scripts/docs-only-changes.mjs"));
  await copyFile(join(projectRoot, "tests/docs/published-content-review.test.mjs"), join(repository, "tests/docs/published-content-review.test.mjs"));
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

async function qualify(fixture, overrides = {}, args = []) {
  return run("node", ["scripts/branch-push-gate.mjs", "qualify", ...args], {
    cwd: fixture.repository,
    env: qualificationEnvironment({ ...fixture, ...overrides }),
  });
}

async function checkPush(repository, updates, remote = "https://example.test/repository.git") {
  return run(join(repository, ".githooks/pre-push"), ["origin", remote], {
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

async function docsFixture(t) {
  const fixture = await makeRepository(t);
  const remote = join(fixture.root, "remote.git");
  await git(fixture.root, "clone", "--bare", fixture.repository, remote);
  await git(fixture.repository, "remote", "add", "origin", remote);
  const base = await git(fixture.repository, "rev-parse", "HEAD");
  await mkdir(join(fixture.repository, "docs/retros"), { recursive: true });
  await mkdir(join(fixture.repository, "docs/reviews"), { recursive: true });
  return { ...fixture, remote, base };
}

async function commitDocs(fixture, name = "first") {
  const file = `docs/retros/${name}.md`;
  const content = `# ${name}\n\nA reviewed retrospective.\n`;
  await writeFile(join(fixture.repository, file), content);
  const hash = createHash("sha256").update(content).digest("hex");
  await writeFile(join(fixture.repository, "docs/reviews/cognitive-accessibility-2026-10-07.md"),
    `${await readFile(join(fixture.repository, "docs/reviews/cognitive-accessibility-2026-10-07.md"), "utf8").catch(() => "# Review\n\nPASS\n")}\n| \`${file}\` | \`${hash}\` |\n`);
  await git(fixture.repository, "add", ".");
  await git(fixture.repository, "commit", "-m", name);
  return git(fixture.repository, "rev-parse", "HEAD");
}

test("docs qualification checks the complete range without invoking npm and binds the real push destination", async (t) => {
  const fixture = await docsFixture(t);
  await commitDocs(fixture);
  const sha = await commitDocs(fixture, "second");
  await qualify(fixture);
  const evidence = JSON.parse(await readFile(await evidencePath(fixture.repository, sha), "utf8"));
  assert.deepEqual(evidence, { route: "docs", sha, base: fixture.base, remote: fixture.remote });
  await assert.rejects(() => stat(join(fixture.root, "npm-calls")), { code: "ENOENT" });
  await checkPush(fixture.repository, [`refs/heads/main ${sha} refs/heads/main ${fixture.base}`], fixture.remote);
  await assert.rejects(() => checkPush(fixture.repository, [`refs/heads/main ${sha} refs/heads/other ${fixture.base}`], fixture.remote), /only valid for origin\/main/);
  await assert.rejects(() => checkPush(fixture.repository, [`refs/heads/main ${sha} refs/heads/main ${zeroOid}`], fixture.remote), /remote base changed/);
  await assert.rejects(() => checkPush(fixture.repository, [`refs/heads/main ${sha} refs/heads/main ${fixture.base}`], "https://wrong.example/repo"), /remote changed/);
  await writeFile(join(fixture.repository, "dirty"), "dirty");
  await assert.rejects(() => checkPush(fixture.repository, [`refs/heads/main ${sha} refs/heads/main ${fixture.base}`], fixture.remote), /clean checkout/);
});

test("docs branch pushes can explicitly select full qualification", async (t) => {
  const fixture = await docsFixture(t);
  const sha = await commitDocs(fixture);
  for (const args of [["--unknown"], ["--full", "--full"]]) {
    await assert.rejects(() => qualify(fixture, {}, args), /usage:/);
    await assert.rejects(() => stat(join(fixture.root, "npm-calls")), { code: "ENOENT" });
    await assert.rejects(async () => stat(await evidencePath(fixture.repository, sha)), { code: "ENOENT" });
  }
  await qualify(fixture, {}, ["--full"]);
  assert.deepEqual((await readFile(join(fixture.root, "npm-calls"), "utf8")).trim().split("\n"), ["ci", "test"]);
  assert.equal(await readFile(await evidencePath(fixture.repository, sha), "utf8"), `${sha}\n`);
  await checkPush(fixture.repository, [`refs/heads/main ${sha} refs/heads/docs-review ${zeroOid}`], fixture.remote);
});

test("the Quality event classifier selects docs checks but not runtime or release work", async (t) => {
  const fixture = await docsFixture(t);
  const workflow = parse(await readFile(join(projectRoot, ".github/workflows/quality.yml"), "utf8"));
  const scope = workflow.jobs["change-scope"].steps.find(({ id }) => id === "scope");
  for (const expectedDocs of [true, false]) {
    if (expectedDocs) await commitDocs(fixture);
    else {
      await writeFile(join(fixture.repository, "runtime.mjs"), "export default true;\n");
      await git(fixture.repository, "add", ".");
      await git(fixture.repository, "commit", "-m", "mixed outgoing range");
    }
    const sha = await git(fixture.repository, "rev-parse", "HEAD");
    const output = join(fixture.root, `scope-${expectedDocs}`);
    await run("bash", ["-e", "-c", scope.run], {
      cwd: fixture.repository,
      env: { ...process.env, BASE_SHA: fixture.base, GITHUB_SHA: sha, GITHUB_OUTPUT: output },
    });
    const outputs = Object.fromEntries((await readFile(output, "utf8")).trim().split("\n").map((line) => line.split("=")));
    assert.equal(outputs.docs_only, String(expectedDocs));
    assert.equal(outputs.base, fixture.base);
    const checked = workflow.jobs.documentation.steps.find(({ run }) => run);
    await run("bash", ["-e", "-c", checked.run], {
      cwd: fixture.repository,
      env: { ...process.env, NODE_TEST_CONTEXT: undefined, DOCS_REVIEW_BASE: outputs.base, GITHUB_SHA: sha },
    });
    for (const id of ["vulnerability-scan", "test", "initializer-qualification", "website-performance", "release-pull-request"]) {
      const expression = workflow.jobs[id].if.replaceAll("${{", "").replaceAll("}}", "")
        .replaceAll("needs.change-scope.outputs.docs_only", "docsOnly");
      const selected = runInNewContext(expression, { docsOnly: outputs.docs_only, github: { event_name: "push", ref: "refs/heads/main" } });
      assert.equal(selected, !expectedDocs, `${id} used the wrong route`);
    }
  }
});

test("an unreviewed earlier document is rejected even when the last commit is reviewed", async (t) => {
  const fixture = await docsFixture(t);
  await writeFile(join(fixture.repository, "docs/retros/unreviewed.md"), "# Unreviewed\n");
  await git(fixture.repository, "add", ".");
  await git(fixture.repository, "commit", "-m", "unreviewed earlier doc");
  const sha = await commitDocs(fixture);
  await assert.rejects(() => qualify(fixture), /Command failed/);
  await assert.rejects(async () => stat(await evidencePath(fixture.repository, sha)), { code: "ENOENT" });
});

test("exact-range review does not hide copy-numbered documents", async (t) => {
  const fixture = await docsFixture(t);
  await writeFile(join(fixture.repository, "docs/retros/unreviewed 2.md"), "# Unreviewed copy\n");
  const sha = await commitDocs(fixture);
  await assert.rejects(() => qualify(fixture), /Command failed/);
  await assert.rejects(async () => stat(await evidencePath(fixture.repository, sha)), { code: "ENOENT" });
});

test("docs whitespace failures write no qualification evidence", async (t) => {
  const fixture = await docsFixture(t);
  await commitDocs(fixture);
  await writeFile(join(fixture.repository, "docs/retros/first.md"), "# first  \n");
  await git(fixture.repository, "add", ".");
  await git(fixture.repository, "commit", "-m", "bad whitespace");
  const sha = await git(fixture.repository, "rev-parse", "HEAD");
  await assert.rejects(() => qualify(fixture));
  await assert.rejects(async () => stat(await evidencePath(fixture.repository, sha)), { code: "ENOENT" });
});

test("mixed paths, renames, symlinks, missing ancestry and empty ranges keep full qualification", async (t) => {
  for (const [name, setup] of [
    ["code", async (f) => writeFile(join(f.repository, "runtime.mjs"), "export default true;\n")],
    ["decision", async (f) => { await mkdir(join(f.repository, "docs/decisions")); await writeFile(join(f.repository, "docs/decisions/new.md"), "# Decision\n"); }],
    ["dependency", async (f) => writeFile(join(f.repository, "package-lock.json"), "{}\n")],
    ["symlink", async (f) => symlink("first.md", join(f.repository, "docs/retros/link.md"))],
    ["rename from excluded path", async (f) => git(f.repository, "mv", "package.json", "docs/retros/manifest.md")],
    ["missing remote base", async (f) => git(f.repository, "--git-dir", f.remote, "update-ref", "-d", "refs/heads/main")],
    ["non-ancestor base", async (f) => {
      await git(f.repository, "checkout", "--orphan", "unrelated");
      await git(f.repository, "add", ".");
      await git(f.repository, "commit", "-m", "unrelated history");
    }],
  ]) {
    await t.test(name, async (t) => {
      const fixture = await docsFixture(t);
      await commitDocs(fixture);
      await setup(fixture);
      await git(fixture.repository, "add", ".");
      await git(fixture.repository, "commit", "--allow-empty", "-m", name);
      await qualify(fixture);
      assert.deepEqual((await readFile(join(fixture.root, "npm-calls"), "utf8")).trim().split("\n"), ["ci", "test"]);
    });
  }
  const fixture = await docsFixture(t);
  await qualify(fixture);
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
