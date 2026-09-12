import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { elicitationFixtures } from "@emseepea/example-ui-shared";
import { ElicitationForm, ResultCard } from "@emseepea/react";
import {
  defineElicitationView,
  defineResultView,
  parseElicitationView,
  parseResultView,
  renderElicitationForm,
  renderResultView,
} from "@emseepea/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("the elicitation contract is strict, bounded, and internally consistent", () => {
  assert.throws(
    () => parseElicitationView({ ...elicitationFixtures.ready, action: "https://attacker.example" }),
    /unrecognized|unknown/i,
  );
  assert.throws(
    () => parseElicitationView({
      ...elicitationFixtures.ready,
      fields: [elicitationFixtures.ready.fields[0], elicitationFixtures.ready.fields[0]],
    }),
    /unique/i,
  );
  assert.throws(
    () => parseElicitationView({
      ...elicitationFixtures.invalid,
      state: {
        ...elicitationFixtures.invalid.state,
        summary: {
          ...elicitationFixtures.invalid.state.summary,
          items: [{ fieldId: "missing", message: "Enter a plan title." }],
        },
      },
    }),
    /reference a field/i,
  );
  assert.throws(
    () => defineElicitationView({
      ...elicitationFixtures.ready,
      heading: "x".repeat(161),
    }),
    /too_big|too big/i,
  );
});

test("the native renderer escapes hostile text and attributes", () => {
  const view = defineElicitationView({
    ...elicitationFixtures.ready,
    heading: '<script>alert("heading")</script>',
    fields: [{
      kind: "text",
      id: "hostile",
      name: "hostile",
      label: "Hostile value",
      value: '"><img src=x onerror=alert("value")>',
    }],
  });
  const html = renderElicitationForm(view, { headingLevel: 2 });
  assert.doesNotMatch(html, /<script|<img/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot;&gt;&lt;img/);
  assert.doesNotMatch(html, /<html|<head|<body|<main|<h1/i);
});

test("native and React renderers preserve the same semantic fixture contract", () => {
  for (const [state, view] of Object.entries(elicitationFixtures)) {
    const native = renderElicitationForm(view, { headingLevel: 2 });
    const react = renderToStaticMarkup(createElement(ElicitationForm, { view, headingLevel: 2 }));
    for (const html of [native, react]) {
      assert.match(html, new RegExp(`data-emseepea-state="${state}"`));
      assert.match(html, /role="status"/);
      assert.match(html, /aria-live="polite"/);
      assert.match(html, /aria-atomic="true"/);
      assert.match(html, /aria-relevant="additions text"/);
      assert.doesNotMatch(html, /<html|<head|<body|<main|<h1/i);
      const focusPart = { invalid: "error-summary", busy: "status", terminal: "terminal" }[state];
      if (focusPart) {
        assert.match(html, new RegExp(`data-emseepea-part="${focusPart}"[^>]*autofocus`));
      }
      if (state === "terminal") {
        assert.doesNotMatch(html, /<form/);
        assert.match(html, /data-emseepea-part="status"[^>]*>Preview ready\.<\/div>/);
        assert.match(html, /No report was sent or stored/);
      } else {
        assert.match(html, /Plan title[^<]*<span data-emseepea-part="required">\(required\)<\/span>/);
        assert.equal((html.match(/<form/g) ?? []).length, 1);
        assert.equal((html.match(/<input/g) ?? []).length, 2);
        assert.equal((html.match(/<select/g) ?? []).length, 1);
      }
      if (state === "invalid") {
        assert.match(html, /data-emseepea-part="error-summary"[^>]*role="alert"/);
        assert.match(html, />Plan title: Enter a plan title\.<\/a>/);
      }
    }
  }
});

const resultView = defineResultView({
  id: "estimate",
  heading: "Your estimate",
  headline: "$640,000",
  summary: "An indicative borrowing estimate.",
  metrics: [{ label: "Monthly income", value: "$9,100" }],
  reasons: { label: "Why this estimate", items: ["Income exceeds assessed expenses."] },
  disclosure: { label: "What's behind this number", items: ["A thirty-year term."] },
  disclaimer: "This is an estimate, not a lending decision.",
  actionsLabel: "Explore another estimate",
  actions: [{ id: "without-card", label: "Without the credit card", accessibleName: "Recalculate without the credit card" }],
  state: { kind: "ready", status: "Borrowing estimate ready: $640,000.", focusTarget: "none" },
});

test("the result contract is strict, bounded, and preserves label in name", () => {
  assert.throws(() => parseResultView({ ...resultView, destination: "https://attacker.example" }), /unrecognized|unknown/i);
  assert.throws(() => parseResultView({ ...resultView, headline: "x".repeat(161) }), /too_big|too big/i);
  assert.throws(() => parseResultView({
    ...resultView,
    actions: [{ id: "without-card", label: "Without the credit card", accessibleName: "Try another scenario" }],
  }), /accessible name must contain/i);
  assert.throws(() => parseResultView({ ...resultView, actionsLabel: undefined, actions: resultView.actions }), /group label/i);
});

test("native and React result renderers preserve semantics and escape hostile text", () => {
  const hostile = defineResultView({
    ...resultView,
    heading: '<script>alert("heading")</script>',
    metrics: [{ label: "Value", value: '"><img src=x onerror=alert("value")>' }],
  });
  const native = renderResultView(hostile, { headingLevel: 2, idPrefix: "native-result" });
  const react = renderToStaticMarkup(createElement(ResultCard, {
    view: hostile,
    headingLevel: 2,
    idPrefix: "react-result",
  }));
  for (const html of [native, react]) {
    assert.match(html, /data-emseepea-part="result-view"/);
    assert.match(html, /role="status"[^>]+aria-live="polite"/);
    assert.match(html, /<dl[^>]*>.*<dt>Value<\/dt><dd>/);
    assert.match(html, /<details[^>]*><summary>/);
    assert.match(html, /<ul[^>]+aria-labelledby="[^"]+--reasons-label"/);
    assert.match(html, /<button[^>]+type="button"|<button type="button"/);
    assert.doesNotMatch(html, /<script|<img|<html|<head|<body|<main|<h1/i);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&quot;&gt;&lt;img/);
  }
});

test("native and React result renderers share every result state", () => {
  for (const kind of ["loading", "ready", "updated", "empty", "sending", "sent", "error"]) {
    const focusTarget = ["sending", "sent", "error"].includes(kind) ? "status" : "none";
    const view = defineResultView({
      ...resultView,
      state: { kind, status: `Result ${kind}.`, focusTarget },
    });
    for (const html of [
      renderResultView(view, { headingLevel: 2, idPrefix: `native-${kind}` }),
      renderToStaticMarkup(createElement(ResultCard, { view, headingLevel: 2, idPrefix: `react-${kind}` })),
    ]) {
      assert.match(html, new RegExp(`data-emseepea-state="${kind}"`));
      assert.match(html, new RegExp(`data-emseepea-part="status"[^>]*>Result ${kind}\\.<`));
      if (focusTarget === "status") assert.match(html, /data-emseepea-part="status"[^>]*autofocus/);
    }
  }
});

test("the native result action focus target stays in the tab order", () => {
  const html = renderResultView({
    ...resultView,
    actions: [
      { id: "disabled", label: "Unavailable", disabled: true },
      ...resultView.actions,
    ],
    state: { kind: "ready", status: "Choose an action.", focusTarget: "actions" },
  }, { headingLevel: 2, idPrefix: "native-actions" });
  assert.match(html, /data-emseepea-action="without-card"[^>]+autofocus/);
  assert.doesNotMatch(html, /<button[^>]+tabindex="-1"/);
  assert.throws(() => defineResultView({
    ...resultView,
    actions: [{ id: "disabled", label: "Unavailable", disabled: true }],
    state: { kind: "ready", status: "Choose an action.", focusTarget: "actions" },
  }), /enabled action/);
  assert.throws(() => renderResultView(resultView, { headingLevel: 2, idPrefix: "bad prefix" }), /valid identifier/);
});

test("UI package boundaries keep frontend and Tailwind dependencies out of core", async () => {
  const server = JSON.parse(await readFile(new URL("../../packages/framework/package.json", import.meta.url), "utf8"));
  const react = JSON.parse(await readFile(new URL("../../packages/react/package.json", import.meta.url), "utf8"));
  const svelte = JSON.parse(await readFile(new URL("../../packages/svelte/package.json", import.meta.url), "utf8"));
  const tailwind = JSON.parse(await readFile(new URL("../../packages/tailwind/package.json", import.meta.url), "utf8"));
  const reactSource = await readFile(new URL("../../packages/react/src/index.tsx", import.meta.url), "utf8");
  const exampleSource = await readFile(new URL("../../examples/react-ui-server/src/client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../../packages/tailwind/dist/emseepea.css", import.meta.url), "utf8");

  assert.equal(react.private, false);
  assert.equal(svelte.private, false);
  assert.equal(tailwind.private, false);
  assert.equal(server.dependencies.react, undefined);
  assert.equal(server.dependencies["react-dom"], undefined);
  assert.equal(server.dependencies.svelte, undefined);
  assert.equal(server.dependencies.tailwindcss, undefined);
  assert.deepEqual(server.exports["./ui"], {
    types: "./dist/ui.d.ts",
    import: "./dist/ui.js",
  });
  assert.equal(react.dependencies["@emseepea/server"], server.version);
  assert.equal(svelte.dependencies["@emseepea/server"], server.version);
  assert.equal(react.peerDependencies.react, "^19.0.0");
  assert.deepEqual(tailwind.exports, { "./styles.css": "./dist/emseepea.css" });
  assert.equal(tailwind.dependencies, undefined);
  assert.doesNotMatch(reactSource, /fetch\(|dangerouslySetInnerHTML|tailwind/i);
  assert.match(reactSource, /@emseepea\/server\/ui/);
  assert.match(exampleSource, /fetch\("\/"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\[aria-invalid/);
  assert.match(css, /\[aria-busy/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.ok(Buffer.byteLength(css) <= 10 * 1024);
  assert.ok(gzipSync(css).byteLength <= 3 * 1024);
});
