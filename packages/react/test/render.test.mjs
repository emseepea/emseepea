import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ElicitationForm, ResultCard } from "../dist/index.js";

const view = {
  id: "package-check",
  heading: "Preview a report",
  intro: "Review the options before continuing.",
  legend: "Report options",
  submitLabel: "Create preview",
  fields: [{
    kind: "text",
    id: "title",
    name: "title",
    label: "Report title",
    description: "Name this preview.",
    required: true,
    minLength: 1,
    maxLength: 80,
    value: "Overview",
  }],
  state: { kind: "ready", focusTarget: "none" },
};

test("the package renders an accessible embedded form without owning the page shell", () => {
  const html = renderToStaticMarkup(createElement(ElicitationForm, { view, headingLevel: 2 }));

  assert.match(html, /<h2 id="package-check--heading">Preview a report<\/h2>/);
  assert.match(html, /<label for="package-check--field--title">Report title/);
  assert.match(html, /<input[^>]+required=""[^>]+aria-describedby="package-check--field--title--description"/);
  assert.match(html, /role="status"[^>]+aria-live="polite"/);
  assert.doesNotMatch(html, /<(?:html|title|main|h1)\b/);
});

const result = {
  id: "result-check",
  heading: "Your estimate",
  headline: "$640,000",
  summary: "An indicative borrowing estimate.",
  metrics: [{ label: "Monthly income", value: "$9,100", hint: "after tax" }],
  assumptions: { label: "Assumptions", items: ["A thirty-year term."] },
  disclosure: { label: "What's behind this number", items: ["A three percent serviceability buffer."] },
  disclaimer: "This is an estimate, not a lending decision.",
  actionsLabel: "Explore another estimate",
  actions: [{ id: "without-card", label: "Without the credit card", accessibleName: "Recalculate without the credit card" }],
  state: { kind: "ready", status: "Borrowing estimate ready: $640,000.", focusTarget: "none" },
};

test("the package renders an accessible result without owning the page shell", () => {
  const html = renderToStaticMarkup(createElement(ResultCard, { view: result, headingLevel: 2, idPrefix: "estimate" }));

  assert.match(html, /<section[^>]+aria-labelledby="estimate--heading"/);
  assert.match(html, /<h2 id="estimate--heading">Your estimate<\/h2>/);
  assert.match(html, /role="status"[^>]+aria-live="polite"/);
  assert.match(html, /<dl[^>]*>.*<dt>Monthly income <span[^>]*>\(after tax\)<\/span><\/dt><dd>\$9,100<\/dd>/);
  assert.match(html, /<p id="estimate--assumptions-label"[^>]*>Assumptions<\/p><ul aria-labelledby="estimate--assumptions-label">/);
  assert.match(html, /<details[^>]*><summary>What&#x27;s behind this number<\/summary>/);
  assert.match(html, /<button[^>]+aria-label="Recalculate without the credit card"[^>]*>Without the credit card<\/button>/);
  assert.doesNotMatch(html, /<(?:html|title|main|h1|img|svg)\b/);
});

test("result instances generate distinct relationships and reject malformed prefixes", () => {
  const html = renderToStaticMarkup(createElement("div", null,
    createElement(ResultCard, { view: result, headingLevel: 2 }),
    createElement(ResultCard, { view: result, headingLevel: 2 }),
  ));
  const labelledBy = [...html.matchAll(/<section[^>]+aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(labelledBy.length, 2);
  assert.notEqual(labelledBy[0], labelledBy[1]);
  assert.throws(
    () => renderToStaticMarkup(createElement(ResultCard, { view: result, headingLevel: 2, idPrefix: "bad prefix" })),
    /valid identifier/,
  );
});
