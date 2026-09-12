import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";
import { compile } from "svelte/compiler";

const source = await readFile(new URL("../src/ResultCard.svelte", import.meta.url), "utf8");

test("the component compiles for client and server", () => {
  for (const generate of ["client", "server"]) {
    const result = compile(source, { filename: "ResultCard.svelte", generate });
    assert.ok(result.js.code.length > 0);
    assert.equal(result.warnings.filter(({ code }) => !["a11y_autofocus", "a11y_no_noninteractive_tabindex"].includes(code)).length, 0);
  }
});

test("the server renderer preserves result semantics and escapes hostile text", async () => {
  const result = await build({
    stdin: {
      contents: 'import { render } from "svelte/server"; import ResultCard from "./src/ResultCard.svelte"; export const card = (view) => render(ResultCard, { props: { view, headingLevel: 2, idPrefix: "svelte-result" } }).body;',
      resolveDir: new URL("..", import.meta.url).pathname,
    },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    plugins: [{
      name: "svelte-server",
      setup(builder) {
        builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
          contents: compile(await readFile(path, "utf8"), { filename: path, generate: "server" }).js.code,
          loader: "js",
        }));
      },
    }],
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
  const html = module.card({
    id: "result-check",
    heading: '<script>alert("heading")</script>',
    headline: "$640,000",
    metrics: [{ label: "Monthly income", value: "$9,100" }],
    reasons: { label: "Why this estimate", items: ["Income exceeds assessed expenses."] },
    disclosure: { label: "What's behind this number", items: ["A thirty-year term."] },
    disclaimer: "This is an estimate, not a lending decision.",
    actionsLabel: "Explore another estimate",
    actions: [{ id: "without-card", label: "Without the credit card", accessibleName: "Recalculate without the credit card" }],
    state: { kind: "ready", status: "Borrowing estimate ready: $640,000.", focusTarget: "none" },
  });
  assert.match(html, /<section[^>]+aria-labelledby="svelte-result--heading"/);
  assert.match(html, /role="status"[^>]+aria-live="polite"/);
  assert.match(html, /<dl[^>]*>.*<dt>Monthly income.*<\/dt>\s*<dd>\$9,100<\/dd>/);
  assert.match(html, /<details[^>]*><summary>What's behind this number<\/summary>/);
  assert.doesNotMatch(html, /<script|<html|<head|<body|<main|<h1/i);
  assert.match(html, /&lt;script>/);
});
