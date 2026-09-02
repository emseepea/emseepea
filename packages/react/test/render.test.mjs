import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ElicitationForm } from "../dist/index.js";

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
