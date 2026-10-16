import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createNativeEvidenceRun } from "../test-support/webmcp-artifacts.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "webmcp-artifacts-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, "native");
  return { directory, root, create: (options = {}) => createNativeEvidenceRun({ root, sourceSha256: hash("semantic source"), ...options }) };
}
async function completedFiles(evidence) {
  const summaries = [];
  for (const [index, path] of evidence.paths.entries()) {
    const bytes = JSON.stringify({ synthetic: true, sequence: 1 }) + "\n";
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    summaries.push({ trial: index + 1, calls: 1, feedbackCount: 0,
      browserVersions: ["154.0.8037.57"], nativeEvidenceSha256: hash(bytes) });
  }
  return summaries;
}

test("each invocation isolates repeated case names and preserves legacy evidence with private provenance", async (t) => {
  const f = await fixture(t);
  await mkdir(f.root);
  const legacy = join(f.root, "old-case.json");
  await writeFile(legacy, "prior failed run");
  const first = await f.create();
  const second = await f.create({ revision: "a".repeat(40) });
  const a = await first.createCase("same case");
  const b = await second.createCase("same case");
  assert.notEqual(first.runId, second.runId);
  assert.notEqual(a.paths[0], b.paths[0]);
  const manifest = JSON.parse(await readFile(join(a.directory, "case.json")));
  assert.equal(manifest.runId, first.runId);
  assert.equal(manifest.sourceSha256, hash("semantic source"));
  assert.equal(manifest.revision, null);
  assert.equal(manifest.revisionEvidence, "absent");
  assert.deepEqual(manifest.files.map(({ trial }) => trial), [1, 2, 3]);
  assert.match(manifest.semanticQualification, /not established/);
  const reported = JSON.parse(await readFile(join(second.directory, "run.json")));
  assert.equal(reported.revision, "a".repeat(40));
  assert.match(reported.revisionEvidence, /caller-reported/);
  assert.equal(await readFile(legacy, "utf8"), "prior failed run");
  assert.equal((await stat(first.directory)).mode & 0o777, 0o700);
  assert.equal((await stat(a.directory)).mode & 0o777, 0o700);
  assert.equal((await stat(join(a.directory, "case.json"))).mode & 0o777, 0o600);
});

test("startup and turn failures retain missing or partial execution files without a correlation checkpoint", async (t) => {
  const f = await fixture(t);
  const run = await f.create();
  const evidence = await run.createCase("timed out case");
  const manifest = JSON.parse(await readFile(join(evidence.directory, "case.json")));
  assert.match(manifest.executionEvidence, /Neither proves absence/);
  const partial = '{"sequence":1';
  await writeFile(evidence.paths[0], partial, { flag: "wx", mode: 0o600 });
  await assert.rejects(evidence.recordCheckpoint([{ trial: 1, nativeEvidenceSha256: hash(partial) },
    { trial: 2, nativeEvidenceSha256: hash("") }, { trial: 3, nativeEvidenceSha256: hash("") }]), /ENOENT/);
  assert.equal(await readFile(evidence.paths[0], "utf8"), partial);
  assert.equal((await readdir(evidence.directory)).some((name) => name.startsWith("correlation-")), false);
});

test("checkpoints bind exact verified bytes and never overwrite earlier checkpoints or verify appended activity", async (t) => {
  const f = await fixture(t);
  const run = await f.create();
  const evidence = await run.createCase("two turns");
  const summaries = await completedFiles(evidence);
  const first = await evidence.recordCheckpoint(summaries);
  const firstBytes = await readFile(first);
  await appendFile(evidence.paths[0], '{"sequence":2}\n');
  await assert.rejects(evidence.recordCheckpoint(summaries), /precisely the verified bytes/);
  assert.deepEqual(await readFile(first), firstBytes);
  summaries[0].nativeEvidenceSha256 = hash(await readFile(evidence.paths[0]));
  summaries[0].calls = 2;
  const second = await evidence.recordCheckpoint(summaries);
  assert.notEqual(first, second);
  const checkpoint = JSON.parse(await readFile(second));
  assert.equal(checkpoint.runId, run.runId);
  assert.equal(checkpoint.checkpoint, 2);
  assert.match(checkpoint.verification, /later activity is not verified/);
  assert.match(checkpoint.semanticQualification, /requires the matching semantic/);
  assert.equal((await stat(second)).mode & 0o777, 0o600);
  await evidence.recordCheckpoint(summaries);
  await evidence.recordCheckpoint(summaries);
  await assert.rejects(evidence.recordCheckpoint(summaries), /checkpoint bound/);
});

test("artifact creation rejects invalid provenance, symlink roots, duplicate cases and oversized native evidence", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.create({ sourceSha256: "invalid" }));
  await assert.rejects(f.create({ revision: "unverified-branch-name" }));
  await mkdir(join(f.directory, "target"));
  await symlink(join(f.directory, "target"), join(f.directory, "linked"));
  await assert.rejects(f.create({ root: join(f.directory, "linked") }), /real directory/);
  const run = await f.create();
  const evidence = await run.createCase("large");
  await assert.rejects(run.createCase("large"), /Duplicate case/);
  await run.createCase("case 2");
  await run.createCase("case 3");
  await run.createCase("case 4");
  await assert.rejects(run.createCase("case 5"), /case bound/);
  const bytes = "x".repeat(1_048_577);
  await writeFile(evidence.paths[0], bytes);
  await assert.rejects(evidence.recordCheckpoint([1, 2, 3].map((trial) => ({ trial,
    nativeEvidenceSha256: hash(bytes) }))), /exceeds its bound/);
});
