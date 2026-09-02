import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { elicitationFixtures } from "@emseepea/example-ui-shared";
import { ElicitationForm } from "@emseepea/react";
import {
  defineElicitationView,
  parseElicitationView,
  renderElicitationForm,
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
          items: [{ fieldId: "missing", message: "Enter a report title." }],
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
      value: '\"><img src=x onerror=alert("value")>',
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
        assert.match(html, /Report title[^<]*<span data-emseepea-part="required">\(required\)<\/span>/);
        assert.equal((html.match(/<form/g) ?? []).length, 1);
        assert.equal((html.match(/<input/g) ?? []).length, 2);
        assert.equal((html.match(/<select/g) ?? []).length, 1);
      }
      if (state === "invalid") {
        assert.match(html, /data-emseepea-part="error-summary"[^>]*role="alert"/);
        assert.match(html, />Report title: Enter a report title\.<\/a>/);
      }
    }
  }
});

test("UI package boundaries keep frontend and Tailwind dependencies out of core", async () => {
  const server = JSON.parse(await readFile(new URL("../../packages/framework/package.json", import.meta.url), "utf8"));
  const react = JSON.parse(await readFile(new URL("../../packages/react/package.json", import.meta.url), "utf8"));
  const tailwind = JSON.parse(await readFile(new URL("../../packages/tailwind/package.json", import.meta.url), "utf8"));
  const reactSource = await readFile(new URL("../../packages/react/src/index.tsx", import.meta.url), "utf8");
  const exampleSource = await readFile(new URL("../../examples/react-tailwind-ui/src/client.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../../packages/tailwind/dist/emseepea.css", import.meta.url), "utf8");

  assert.equal(react.private, false);
  assert.equal(tailwind.private, false);
  assert.equal(server.dependencies.react, undefined);
  assert.equal(server.dependencies["react-dom"], undefined);
  assert.equal(server.dependencies.tailwindcss, undefined);
  assert.deepEqual(server.exports["./ui"], {
    types: "./dist/ui.d.ts",
    import: "./dist/ui.js",
  });
  assert.equal(react.dependencies["@emseepea/server"], server.version);
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
