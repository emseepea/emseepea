import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/merge-publish-back.sh");

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "emseepea-merge-back-"));
  const remote = join(root, "remote.git");
  const author = join(root, "author");
  const runner = join(root, "runner");
  git(root, "init", "--bare", remote);
  git(root, "init", "-b", "main", author);
  git(author, "config", "user.name", "Test Author");
  git(author, "config", "user.email", "test@example.com");
  git(author, "remote", "add", "origin", remote);
  mkdirSync(join(author, ".changeset"), { recursive: true });
  writeFileSync(join(author, ".changeset", "README.md"), "# Changesets\n");
  writeFileSync(join(author, "value.txt"), "base\n");
  git(author, "add", ".");
  git(author, "commit", "-m", "base");
  const base = git(author, "rev-parse", "HEAD");
  git(author, "checkout", "-b", "publish");
  writeFileSync(join(author, "value.txt"), "published\n");
  git(author, "add", "value.txt");
  git(author, "commit", "-m", "publish");
  const publish = git(author, "rev-parse", "HEAD");
  git(author, "push", "origin", "main", "publish");
  git(root, "clone", remote, runner);
  git(runner, "config", "user.name", "Test Runner");
  git(runner, "config", "user.email", "runner@example.com");
  return { root, remote, author, runner, base, publish };
}

function run(f, expectedPublish = f.publish) {
  const output = join(f.root, "github-output.txt");
  writeFileSync(output, "");
  const result = spawnSync("bash", [script, expectedPublish], {
    cwd: f.runner,
    env: { ...process.env, GITHUB_OUTPUT: output },
    encoding: "utf8",
  });
  return {
    ...result,
    outputs: result.status === 0 ? readFileSync(output, "utf8") : "",
    main: git(f.runner, "ls-remote", "origin", "refs/heads/main").split(/\s+/)[0],
  };
}

function setMain(f, commit) {
  git(f.author, "push", "--force", "origin", `${commit}:main`);
}

function commitTree(f, parents, message = "synthetic merge") {
  const tree = git(f.author, "rev-parse", `${f.publish}^{tree}`);
  const args = ["commit-tree", tree, "-m", message];
  for (const parent of parents) args.push("-p", parent);
  return git(f.author, ...args);
}

test("a first merge and its exact retry return the same release identity", () => {
  const f = fixture();
  const first = run(f);
  assert.equal(first.status, 0, first.stderr);
  const mergeBack = first.main;
  assert.match(first.stdout, /Merged .* back into main on attempt 1\./);
  assert.equal(first.outputs, `base_sha=${f.base}\npublish_sha=${f.publish}\nmerge_back_sha=${mergeBack}\n`);

  const retried = run(f);
  assert.equal(retried.status, 0, retried.stderr);
  assert.equal(retried.main, mergeBack);
  assert.match(retried.stdout, /Recovered the existing merge/);
  assert.equal(retried.outputs, first.outputs);
});

test("recovery refuses every non-exact main relationship", () => {
  for (const scenario of [
    {
      name: "one parent",
      parents: (f) => [f.publish],
    },
    {
      name: "reversed parents",
      parents: (f) => [f.publish, f.base],
    },
    {
      name: "three parents",
      parents: (f) => [f.base, f.publish, commitTree(f, [f.base], "third parent")],
    },
  ]) {
    const f = fixture();
    const main = commitTree(f, scenario.parents(f), scenario.name);
    setMain(f, main);
    const result = run(f);
    assert.notEqual(result.status, 0, scenario.name);
    assert.match(result.stderr, /origin\/main contains .* but is not its exact two-parent merge-back commit\. Inspect origin\/main before retrying\./);
    assert.equal(result.main, main);
  }
});

test("recovery refuses later trunk work, moved publish, and retained changesets", () => {
  {
    const f = fixture();
    assert.equal(run(f).status, 0);
    git(f.author, "fetch", "origin", "main");
    git(f.author, "checkout", "--detach", "origin/main");
    writeFileSync(join(f.author, "later.txt"), "later\n");
    git(f.author, "add", "later.txt");
    git(f.author, "commit", "-m", "later trunk work");
    const later = git(f.author, "rev-parse", "HEAD");
    setMain(f, later);
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /origin\/main contains .* but is not its exact two-parent merge-back commit\. Inspect origin\/main before retrying\./);
  }
  {
    const f = fixture();
    const stalePublish = f.publish;
    git(f.author, "checkout", "publish");
    writeFileSync(join(f.author, "moved.txt"), "moved\n");
    git(f.author, "add", "moved.txt");
    git(f.author, "commit", "-m", "move publish");
    git(f.author, "push", "origin", "publish");
    const result = run(f, stalePublish);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /origin\/publish moved/);
  }
  {
    const f = fixture();
    const pendingTree = mkdtempSync(join(tmpdir(), "emseepea-pending-"));
    git(f.root, "clone", f.remote, pendingTree);
    git(pendingTree, "config", "user.name", "Pending Author");
    git(pendingTree, "config", "user.email", "pending@example.com");
    git(pendingTree, "checkout", "publish");
    writeFileSync(join(pendingTree, ".changeset", "pending.md"), "---\n");
    git(pendingTree, "add", ".changeset/pending.md");
    git(pendingTree, "commit", "-m", "retain a changeset");
    git(pendingTree, "push", "origin", "publish");
    f.publish = git(pendingTree, "rev-parse", "HEAD");
    git(f.author, "fetch", "origin", "publish");
    const exactMerge = commitTree(f, [f.base, f.publish], "merge retaining changeset");
    setMain(f, exactMerge);
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /consumed changesets remain on main/);
  }
});
