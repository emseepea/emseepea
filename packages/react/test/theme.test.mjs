import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { useMcpTheme } from "../dist/index.js";
import { subscribeSystemTheme, systemTheme } from "../dist/theme.js";

function Theme({ hostTheme }) {
  return createElement("span", null, useMcpTheme(hostTheme));
}

test("the theme hook is server-safe and gives the host theme precedence", () => {
  assert.equal(renderToStaticMarkup(createElement(Theme)), "<span>light</span>");
  assert.equal(renderToStaticMarkup(createElement(Theme, { hostTheme: "dark" })), "<span>dark</span>");
  assert.equal(renderToStaticMarkup(createElement(Theme, { hostTheme: "blue" })), "<span>light</span>");
});

test("the browser theme subscription follows changes and cleans up", (t) => {
  let listener;
  let removed;
  const preference = {
    matches: true,
    addEventListener: (event, callback) => { assert.equal(event, "change"); listener = callback; },
    removeEventListener: (event, callback) => { assert.equal(event, "change"); removed = callback; },
  };
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => preference };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  assert.equal(systemTheme(), "dark");
  let changes = 0;
  const unsubscribe = subscribeSystemTheme(() => { changes += 1; });
  listener();
  assert.equal(changes, 1);
  unsubscribe();
  assert.equal(removed, listener);
});

test("the browser theme subscription supports legacy media query listeners", (t) => {
  let listener;
  let removed;
  const preference = {
    matches: false,
    addListener: (callback) => { listener = callback; },
    removeListener: (callback) => { removed = callback; },
  };
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => preference };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  let changes = 0;
  const unsubscribe = subscribeSystemTheme(() => { changes += 1; });
  listener();
  assert.equal(changes, 1);
  unsubscribe();
  assert.equal(removed, listener);
});
