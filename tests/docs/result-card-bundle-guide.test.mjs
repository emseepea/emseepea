import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);

test("the result-card recommendation matches the reproducible bundle comparison", async () => {
  const { stdout } = await exec(process.execPath, ["scripts/measure-result-card-bundles.mjs"]);
  const comparison = JSON.parse(stdout);
  const guide = await readFile(new URL("../../packages/framework/README.md", import.meta.url), "utf8");

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
  for (const size of Object.values(comparison.measurements).flatMap(Object.values)) {
    assert.ok(guide.includes(size.toLocaleString("en-AU")), `guide does not record ${size}`);
  }
  assert.match(guide, /self-contained MCP App resource/);
  assert.match(guide, /already uses React/);
  assert.match(guide, /not a general claim about framework bundle sizes/);
});
