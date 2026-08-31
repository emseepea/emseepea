#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const registry = "https://registry.npmjs.org";
const packageFiles = [
  ["@emseepea/server", "packages/framework/package.json"],
  ["@emseepea/testing", "packages/testing/package.json"],
];

export function classifyPublication(before, after) {
  const previous = before.packages.map(({ present }) => present);
  if (previous.every(Boolean)) return "unchanged";
  assert.ok(previous.every((present) => !present), "only one package version existed before publication");
  const current = after.packages.map(({ present }) => present);
  if (current.every(Boolean)) return "published";
  if (current.some(Boolean)) throw new Error("only one package was published");
  return "missing";
}

export function assertRegistryState(before, after) {
  assert.equal(after.packages.length, before.packages.length);
  for (const expected of before.packages) {
    const actual = after.packages.find(({ name }) => name === expected.name);
    assert.ok(actual, `${expected.name} registry metadata is missing`);
    assert.equal(actual.version, expected.version);
    assert.equal(actual.next, expected.version, `${expected.name} next tag is wrong`);
    assert.equal(actual.latest, expected.latest, `${expected.name} latest tag changed`);
    assert.notEqual(actual.latest, expected.version, `${expected.name} latest tag points to the pre-alpha release`);
    assert.match(actual.integrity, /^sha512-/, `${expected.name} integrity is missing`);
    assert.ok(actual.tarball, `${expected.name} tarball is missing`);
    assert.ok(actual.attestationsUrl, `${expected.name} attestations are missing`);
    assert.ok(actual.signatures > 0, `${expected.name} registry signature is missing`);
  }
}

export function assertProvenance(statement, expected) {
  assert.equal(statement?._type, "https://in-toto.io/Statement/v1");
  assert.equal(statement?.predicateType, "https://slsa.dev/provenance/v1");
  const workflow = statement?.predicate?.buildDefinition?.externalParameters?.workflow;
  assert.deepEqual(workflow, {
    ref: expected.ref,
    repository: expected.repository,
    path: expected.workflowPath,
  });
  const dependency = statement?.predicate?.buildDefinition?.resolvedDependencies?.find(
    ({ digest }) => digest?.gitCommit === expected.sha,
  );
  assert.ok(dependency, "provenance does not bind the release commit");
  assert.ok(
    statement?.predicate?.runDetails?.metadata?.invocationId?.startsWith(expected.invocationPrefix),
    "provenance does not bind the release workflow run",
  );
  const subject = statement?.subject?.find(({ name }) => name === expected.subject);
  assert.ok(subject, "provenance does not name the published package");
  assert.equal(subject.digest?.sha512, expected.sha512);
}

export function provenanceIncludesCommit(statement, sha) {
  return Boolean(statement?.predicate?.buildDefinition?.resolvedDependencies?.some(
    ({ digest }) => digest?.gitCommit === sha,
  ));
}

export function classifyRecovery(statements, sha) {
  const matches = statements.map((statement) => provenanceIncludesCommit(statement, sha));
  if (matches.some(Boolean) && !matches.every(Boolean)) {
    throw new Error("only one package has provenance for this release commit");
  }
  return matches.every(Boolean) ? "recovery" : "unrelated";
}

async function capture(path) {
  const packages = await Promise.all(packageFiles.map(async ([name, manifestPath]) => {
    const { version } = JSON.parse(await readFile(manifestPath, "utf8"));
    const metadata = await fetchPackage(name);
    return {
      name,
      version,
      present: Boolean(metadata?.versions?.[version]),
      latest: metadata?.["dist-tags"]?.latest ?? "",
    };
  }));
  await writeJson(path, { packages });
}

async function verify(beforePath, afterPath) {
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const prior = classifyPublication(before, { packages: before.packages });
  if (prior === "unchanged") {
    const after = { packages: await Promise.all(before.packages.map(readCurrent)) };
    assertRegistryState(before, after);
    const statements = await Promise.all(after.packages.map(readProvenance));
    const recovery = classifyRecovery(statements, process.env.GITHUB_SHA);
    if (recovery === "recovery") {
      assertStatements(after, statements, `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/`);
      await writeOutput("published", "true");
      await writeOutput("recovery", "true");
    } else {
      await writeOutput("published", "false");
      await writeOutput("recovery", "false");
    }
    await writeJson(afterPath, after);
    return;
  }

  let after;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    after = { packages: await Promise.all(before.packages.map(readCurrent)) };
    const result = classifyPublication(before, after);
    if (result === "published") break;
    if (attempt < 10) await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
  }
  const result = classifyPublication(before, after);
  assert.equal(result, "published", "neither package appeared after publication");
  assertRegistryState(before, after);

  const statements = await Promise.all(after.packages.map(readProvenance));
  assertStatements(
    after,
    statements,
    `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/`,
  );
  await writeJson(afterPath, after);
  await writeOutput("published", "true");
  await writeOutput("recovery", "false");
}

function assertStatements(after, statements, invocationPrefix) {
  const expectedRun = {
    ref: process.env.GITHUB_REF,
    repository: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`,
    workflowPath: ".github/workflows/release.yml",
    sha: process.env.GITHUB_SHA,
    invocationPrefix,
  };
  for (const [index, item] of after.packages.entries()) {
    const statement = statements[index];
    assertProvenance(statement, {
      ...expectedRun,
      subject: `pkg:npm/${encodeURIComponent(item.name).replace("%2F", "/")}@${item.version}`,
      sha512: Buffer.from(item.integrity.slice("sha512-".length), "base64").toString("hex"),
    });
  }
}

async function readProvenance(item) {
  const response = await fetch(item.attestationsUrl, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.ok, true, `${item.name} attestations returned ${response.status}`);
  const attestations = await response.json();
  const provenance = attestations.attestations?.find(
    ({ predicateType }) => predicateType === "https://slsa.dev/provenance/v1",
  );
  assert.ok(provenance, `${item.name} SLSA provenance is missing`);
  return JSON.parse(Buffer.from(provenance.bundle.dsseEnvelope.payload, "base64").toString());
}

async function readCurrent(expected) {
  const metadata = await fetchPackage(expected.name);
  const version = metadata?.versions?.[expected.version];
  return {
    name: expected.name,
    version: expected.version,
    present: Boolean(version),
    latest: metadata?.["dist-tags"]?.latest ?? "",
    next: metadata?.["dist-tags"]?.next ?? "",
    integrity: version?.dist?.integrity ?? "",
    tarball: version?.dist?.tarball ?? "",
    attestationsUrl: version?.dist?.attestations?.url ?? "",
    signatures: version?.dist?.signatures?.length ?? 0,
  };
}

async function fetchPackage(name) {
  const response = await fetch(`${registry}/${encodeURIComponent(name)}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (response.status === 404) return undefined;
  assert.equal(response.ok, true, `${name} registry metadata returned ${response.status}`);
  return response.json();
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await writeFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: "a" });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, firstPath, secondPath] = process.argv.slice(2);
  if (command === "capture" && firstPath) await capture(firstPath);
  else if (command === "verify" && firstPath && secondPath) await verify(firstPath, secondPath);
  else throw new Error("Usage: verify-registry-release capture <before.json> | verify <before.json> <after.json>");
}
