import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);

test("the reproducible result-card bundle comparison meets its recommendation threshold", async () => {
  const { stdout } = await exec(process.execPath, ["scripts/measure-result-card-bundles.mjs"]);
  const comparison = JSON.parse(stdout);

  assert.deepEqual(comparison.tools, {
    esbuild: "0.28.2",
    svelte: "5.57.0",
    react: "19.2.8",
    reactDom: "19.2.8",
  });
  assert.deepEqual(comparison.settings, {
    minify: true,
    format: "esm",
    target: "es2022",
    sourceMap: false,
    gzipLevel: 9,
    brotliQuality: 11,
  });
  assert.ok(comparison.reduction.gzip >= 20);
  assert.ok(comparison.reduction.brotli >= 20);
});
