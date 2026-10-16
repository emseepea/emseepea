import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const maximumNativeBytes = 1_048_576;
const maximumManifestBytes = 65_536;
const semanticQualification = "not established by native evidence; requires the matching semantic harness result";

async function exclusiveJson(path, value) {
  const bytes = JSON.stringify(value, null, 2) + "\n";
  assert.ok(Buffer.byteLength(bytes) <= maximumManifestBytes, "Native evidence manifest exceeds its bound");
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
}

/** Private synthetic evidence only. Never load or overwrite earlier runs. */
export async function createNativeEvidenceRun({ root, sourceSha256, revision }) {
  assert.ok(isAbsolute(root), "Native evidence root must be absolute");
  assert.match(sourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(revision === undefined || /^[a-f0-9]{40}$/.test(revision), "Invalid reported revision");
  await mkdir(root, { recursive: true, mode: 0o700 });
  assert.ok((await lstat(root)).isDirectory(), "Native evidence root must be a real directory");
  const directory = await mkdtemp(join(root, "run-"));
  const provenance = { runId: basename(directory), sourceSha256, revision: revision ?? null,
    revisionEvidence: revision ? "caller-reported; independently verify checkout" : "absent" };
  await exclusiveJson(join(directory, "run.json"), { ...provenance, semanticQualification,
    limits: { cases: 4, trialsPerCase: 3, nativeBytesPerTrial: maximumNativeBytes,
      checkpointsPerCase: 4, manifestBytes: maximumManifestBytes } });
  const cases = new Set();
  return {
    directory, ...provenance,
    async createCase(name) {
      assert.ok(typeof name === "string" && name.trim() && name.length <= 512);
      assert.ok(cases.size < 4 && !cases.has(name), "Duplicate case or native case bound exceeded");
      cases.add(name);
      const caseDirectory = join(directory, hash(name));
      await mkdir(caseDirectory, { mode: 0o700 });
      const files = [1, 2, 3].map((trial) => ({ trial, file: `trial-${trial}.jsonl` }));
      const paths = files.map(({ file }) => join(caseDirectory, file));
      const metadata = { ...provenance, name, semanticQualification };
      await exclusiveJson(join(caseDirectory, "case.json"), { ...metadata, files,
        executionEvidence: "Files may be missing or partial. Neither proves absence of native execution or writes." });
      let checkpointCount = 0;
      return {
        directory: caseDirectory, paths,
        async recordCheckpoint(summaries) {
          assert.equal(summaries.length, 3, "Each checkpoint needs all three native trials");
          for (let index = 0; index < 3; index++) {
            const summary = summaries[index];
            assert.equal(summary.trial, index + 1);
            const bytes = await readFile(paths[index]);
            assert.ok(bytes.length <= maximumNativeBytes, "Native evidence exceeds its bound");
            assert.equal(hash(bytes), summary.nativeEvidenceSha256, "Checkpoint must hash precisely the verified bytes");
          }
          assert.ok(checkpointCount < 4, "Native checkpoint bound exceeded");
          const checkpoint = ++checkpointCount;
          const path = join(caseDirectory, `correlation-${checkpoint}.json`);
          await exclusiveJson(path, { ...metadata, checkpoint,
            verification: "native correlation only, covering these call counts and exact byte hashes; later activity is not verified",
            summaries });
          return path;
        },
      };
    },
  };
}
