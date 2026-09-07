import assert from "node:assert/strict";
import test from "node:test";

import { assertReleaseReadiness } from "../../scripts/verify-release-readiness.mjs";

const registry = { packages: [
  { name: "@emseepea/server", version: "1.0.0", present: true },
  { name: "@emseepea/create-example", version: "0.0.1", present: false },
] };
const review = `
- \`@emseepea/create-example@0.0.1\`

- Result: PASS
- Final result: within appetite.
`;

test("release readiness matches the exact unpublished package set", () => {
  assert.doesNotThrow(() => assertReleaseReadiness(registry, review));
  assert.doesNotThrow(() => assertReleaseReadiness({ packages: [] }, ""));
  assert.throws(() => assertReleaseReadiness(registry, review.replace("0.0.1", "0.0.2")), /package set/);
  assert.throws(() => assertReleaseReadiness(registry, review.replace("PASS", "PENDING")), /Result: PASS/);
  assert.throws(() => assertReleaseReadiness(registry, review.replace("within appetite", "pending")), /within appetite/);
});
