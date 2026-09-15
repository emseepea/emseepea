import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

test("the package builds a bounded stylesheet for forms and Result Cards", async () => {
  const css = await readFile(new URL("../dist/emseepea.css", import.meta.url), "utf8");

  assert.match(css, /\[data-emseepea-part=view\]/);
  for (const part of ["result-view", "headline", "metrics", "metric", "reasons", "assumptions", "disclosure", "actions", "action", "status"]) {
    assert.match(css, new RegExp(`\\[data-emseepea-part=${part}\\]`));
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /:required/);
  assert.match(css, /\[aria-invalid=true\]/);
  assert.match(css, /\[aria-busy=true\]/);
  assert.match(css, /forced-colors:active/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /forced-color-adjust:none/);
  assert.ok(Buffer.byteLength(css) <= 10 * 1024);
  assert.ok(gzipSync(css).byteLength <= 3 * 1024);
});

test("the Result Card semantic colours meet their documented contrast roles", () => {
  for (const [foreground, background, minimum] of [
    ["#18231e", "#ffffff", 4.5],
    ["#18231e", "#e8f6ed", 4.5],
    ["#4b5b52", "#ffffff", 3],
    ["#8b1e2d", "#ffffff", 4.5],
    ["#f5faf7", "#101a15", 4.5],
    ["#f5faf7", "#18231e", 4.5],
    ["#a7b9ae", "#101a15", 3],
    ["#ffb4ab", "#101a15", 4.5],
  ]) assert.ok(contrast(foreground, background) >= minimum);
});

function contrast(foreground, background) {
  const luminance = (hex) => [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
