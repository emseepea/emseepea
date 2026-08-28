import assert from "node:assert/strict";
import test from "node:test";

import { fixtureForState, viewFromSubmission } from "../dist/index.js";

test("shared UI fixtures preserve preview-only semantics", () => {
  assert.equal(fixtureForState("ready").state.kind, "ready");
  const result = viewFromSubmission({ title: "Daily roast", roast: "dark", includeNotes: "on" });
  assert.equal(result.state.kind, "terminal");
  assert.match(result.state.message, /No report was sent or stored/);
});
