import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDirectory = path.join(root, "docs/reviews");
const evidencePattern = /^docs\/reviews\/cognitive-accessibility-\d{4}-\d{2}-\d{2}\.md$/;

test("changed public Markdown has cognitive-accessibility review evidence", async () => {
  const changedMarkdown = changedFiles()
    .filter(isPublicMarkdown)
    .filter((file) => !evidencePattern.test(file))
    .sort();

  if (changedMarkdown.length === 0) return;

  const evidence = await reviewEvidence();
  const missing = changedMarkdown.filter((file) => !evidence.includes(`\`${file}\``));

  assert.deepEqual(
    missing,
    [],
    "changed public Markdown must be named in docs/reviews/cognitive-accessibility-YYYY-MM-DD.md",
  );
});

function changedFiles() {
  return [...new Set([...changedAgainstBase(), ...changedInWorktree()])]
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file && !path.basename(file).includes(" 2."));
}

function changedAgainstBase() {
  const base = process.env.GITHUB_BASE_REF;
  if (!base) return changedByLastCommit();
  return git(["diff", "--name-only", "--diff-filter=ACMRT", `origin/${base}...HEAD`]);
}

function changedByLastCommit() {
  if (process.env.GITHUB_ACTIONS !== "true") return [];
  return git(["show", "--pretty=", "--name-only", "--diff-filter=ACMRT", "HEAD"]);
}

function changedInWorktree() {
  const output = gitRaw(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const files = [];
  for (const entry of output.split("\0").filter(Boolean)) {
    const status = entry.slice(0, 2);
    if (status === " D" || status === "D ") continue;
    files.push(entry.slice(3));
  }
  return files;
}

function git(args) {
  return gitRaw(args).split(/\r?\n/).filter(Boolean);
}

function gitRaw(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trimEnd();
  } catch {
    return "";
  }
}

function isPublicMarkdown(file) {
  if (!file.endsWith(".md")) return false;
  return (
    file === "README.md" ||
    file === "BATTLE-PLAN.md" ||
    file === "QUALITY.md" ||
    file === "SECURITY.md" ||
    file === "SUPPORT.md" ||
    file === "CONTRIBUTING.md" ||
    file.startsWith("docs/") ||
    /^examples\/[^/]+\/README\.md$/.test(file) ||
    /^packages\/[^/]+\/README\.md$/.test(file) ||
    /^\.changeset\/(?!README\.md$).+\.md$/.test(file)
  );
}

async function reviewEvidence() {
  const files = await readdir(evidenceDirectory);
  const reviews = files.filter((file) => /^cognitive-accessibility-\d{4}-\d{2}-\d{2}\.md$/.test(file));
  const contents = await Promise.all(
    reviews.map((file) => readFile(path.join(evidenceDirectory, file), "utf8")),
  );
  return contents.join("\n");
}
