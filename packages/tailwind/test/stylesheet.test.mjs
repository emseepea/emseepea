import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

test("the package builds a bounded stylesheet for semantic form states", async () => {
  const css = await readFile(new URL("../dist/emseepea.css", import.meta.url), "utf8");

  assert.match(css, /\[data-emseepea-part=view\]/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:required/);
  assert.match(css, /\[aria-invalid=true\]/);
  assert.match(css, /\[aria-busy=true\]/);
  assert.match(css, /forced-colors:active/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.ok(Buffer.byteLength(css) <= 10 * 1024);
  assert.ok(gzipSync(css).byteLength <= 3 * 1024);
});
