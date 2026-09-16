import assert from "node:assert/strict";
import test from "node:test";

import { assertWcagContrast, wcagContrastRatio } from "../dist/index.js";

test("calculates WCAG contrast ratios from opaque sRGB hex colors", () => {
  assert.equal(wcagContrastRatio("#000000", "#ffffff"), 21);
  assert.equal(wcagContrastRatio("#ffffff", "#ffffff"), 1);
  assert.ok(Math.abs(wcagContrastRatio("#767676", "#ffffff") - 4.5422249596) < 1e-10);
  assert.ok(Math.abs(wcagContrastRatio("#777777", "#ffffff") - 4.4780894536) < 1e-10);
  assert.equal(
    wcagContrastRatio("#006a8e", "#ffffff"),
    wcagContrastRatio("#ffffff", "#006a8e"),
  );
});

test("asserts the unrounded contrast ratio against the required threshold", () => {
  assert.equal(assertWcagContrast("#000000", "#ffffff", 21), 21);
  assert.throws(
    () => assertWcagContrast("#777777", "#ffffff", 4.5, "body text"),
    (error) => {
      assert.equal(error.name, "AssertionError");
      assert.match(error.message, /body text: #777777 on #ffffff/);
      assert.match(error.message, /4\.48:1; expected at least 4\.5:1/);
      return true;
    },
  );
});

test("rejects unsupported colors and invalid thresholds", () => {
  for (const color of ["777777", "#777", "#777777ff", "white", "", null, 42]) {
    assert.throws(() => wcagContrastRatio(color, "#ffffff"), TypeError);
  }
  assert.throws(
    () => wcagContrastRatio("#000000", "transparent"),
    /background must be an opaque sRGB color in #RRGGBB format/,
  );
  for (const minimumRatio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => assertWcagContrast("#000000", "#ffffff", minimumRatio),
      /minimumRatio must be a finite positive number/,
    );
  }
});
