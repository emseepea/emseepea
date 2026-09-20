#!/usr/bin/env node

// ADR-0098 moves publication to the release pull request, so the evidence
// document is written there rather than in the retired release workflow. The
// content is unchanged; it was a heredoc inside that workflow and is a script
// here so the retirement does not lose it.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function execute(command, args) {
  const { stdout } = await exec(command, args, { encoding: "utf8" });
  return stdout.trim();
}

export async function writeReleaseEvidence(directory, { run = execute, env = process.env } = {}) {
  const packages = JSON.parse(await readFile(`${directory}/packages.json`, "utf8"));
  const packageSummary = packages.map(({ name, version }) => `${name} ${version}`).join("; ");
  const baseImages = (await run("node", ["scripts/container-base-images.mjs"])).split("\n").filter(Boolean);
  assert.equal(baseImages.length, 2, "expected a builder and a runtime base image");

  const reviewRecord = "docs/reviews/current-release-readiness.md";
  const review = await readFile(reviewRecord, "utf8");
  assert.notEqual(review.trim(), "", `${reviewRecord} is empty`);
  await run("node", ["scripts/verify-release-readiness.mjs", `${directory}/registry-before.json`, reviewRecord]);

  const lockSha = createHash("sha256").update(await readFile("package-lock.json")).digest("hex");
  const blob = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/blob/${env.RELEASE_SHA}`;

  const document = [
    "# Em See Pea release evidence",
    "",
    `- Commit: ${env.RELEASE_SHA}`,
    `- Workflow: ${env.RELEASE_RUN_URL}`,
    `- Qualification workflow: ${env.QUALITY_RUN_URL}`,
    `- Lockfile SHA-256: ${lockSha}`,
    `- Packages: ${packageSummary}`,
    `- Node.js: ${await run("node", ["--version"])}`,
    `- npm: ${await run("npm", ["--version"])}`,
    `- GitHub CLI: ${(await run("gh", ["--version"])).split("\n")[0]}`,
    `- Container builder base: ${baseImages[0]}`,
    `- Container runtime base: ${baseImages[1]}`,
    "- Exact-commit Quality qualification: OSV lockfile scan; base image architecture and signature checks; package tests; performance benchmarks; streaming, request-logging, and subscription memory tests; package builds; standalone initializer and container checks",
    "- Request-logging load check: `node --expose-gc --test tests/load/client-logging.test.mjs`",
    "- Subscription load check: `node --expose-gc --test tests/load/subscription-sdk.test.mjs`",
    `- Semantic qualification: ${env.SEMANTIC_EVAL_RUN_URL}, artifact ${env.SEMANTIC_EVAL_ARTIFACT}`,
    `- Reviews: ${blob}/${reviewRecord}`,
    `- Coverage and limits: ${blob}/docs/protocol-coverage.md`,
    await readFile(new URL("release-evidence-scope.md", import.meta.url), "utf8"),
  ].join("\n");

  await writeFile(`${directory}/RELEASE-EVIDENCE.md`, document.endsWith("\n") ? document : `${document}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new Error("Usage: write-release-evidence <release-artifacts-directory>");
  await writeReleaseEvidence(directory);
}
