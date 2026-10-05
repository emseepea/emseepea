import assert from "node:assert/strict";
import test from "node:test";
import { defineFeedbackCollections } from "../dist/index.js";

test("compiles a customer submission-only catalogue without implicit roles", () => {
  const compiled = defineFeedbackCollections({
    collections: ["customer"],
    submissions: [{ collection: "customer", access: "public" }],
  });

  assert.deepEqual(compiled, {
    catalogue: [{ id: "customer", roles: ["submission"] }],
    submissions: [{
      collection: "customer",
      toolName: "submit-customer-feedback",
      access: "public",
      requiredScopes: [],
    }],
    operators: [],
    monitors: [],
  });
  assert.equal("tools" in compiled, false);
  assert.equal(Object.isFrozen(compiled), true);
  assert.equal(Object.isFrozen(compiled.catalogue), true);
  assert.equal(Object.isFrozen(compiled.catalogue[0].roles), true);
  assert.throws(() => compiled.catalogue.push({ id: "internal", roles: [] }), TypeError);
});

test("compiles deterministic overlapping internal role projections", () => {
  const operatorScopes = ["feedback:read"];
  const compiled = defineFeedbackCollections({
    collections: ["internal", "customer"],
    submissions: [{
      collection: "internal",
      access: "protected",
      requiredScopes: ["feedback:submit"],
    }],
    operators: [
      { collection: "internal", access: "protected", requiredScopes: operatorScopes },
      { collection: "customer", access: "protected", requiredScopes: ["feedback:read"] },
    ],
    monitors: [
      { collection: "internal", access: "protected", requiredScopes: ["feedback:events"] },
      { collection: "customer", access: "protected", requiredScopes: ["feedback:events"] },
    ],
  });

  assert.deepEqual(compiled.catalogue, [
    { id: "customer", roles: ["operator", "monitor"] },
    { id: "internal", roles: ["submission", "operator", "monitor"] },
  ]);
  assert.deepEqual(compiled.submissions.map(({ collection, toolName }) => ({ collection, toolName })), [{
    collection: "internal",
    toolName: "submit-internal-feedback",
  }]);
  assert.deepEqual(compiled.operators.map(({ collection }) => collection), ["customer", "internal"]);
  assert.deepEqual(compiled.monitors.map(({ collection }) => collection), ["customer", "internal"]);
  assert.equal(Object.isFrozen(compiled.submissions[0].requiredScopes), true);
  operatorScopes[0] = "changed-after-compilation";
  assert.deepEqual(compiled.operators[1].requiredScopes, ["feedback:read"]);
});

test("rejects invalid, duplicate, undeclared, or implicit collection configuration", () => {
  assert.throws(() => defineFeedbackCollections({ collections: [] }), /at least one collection/i);
  assert.throws(() => defineFeedbackCollections({ collections: ["Internal"] }), /collection/i);
  assert.throws(() => defineFeedbackCollections({ collections: ["internal", "internal"] }), /duplicate collection/i);
  assert.throws(() => defineFeedbackCollections({
    collections: ["internal"],
    operators: [{ collection: "customer", access: "protected", requiredScopes: ["feedback:read"] }],
  }), /undeclared collection/i);
});

test("rejects unenforceable protected roles and selectable submission destinations", () => {
  assert.throws(() => defineFeedbackCollections({
    collections: ["internal"],
    operators: [{ collection: "internal", access: "public" }],
  }), /operator.*protected/i);
  assert.throws(() => defineFeedbackCollections({
    collections: ["internal"],
    monitors: [{ collection: "internal", access: "protected", requiredScopes: [] }],
  }), /monitor.*scope/i);
  assert.throws(() => defineFeedbackCollections({
    collections: ["internal"],
    monitors: [{ collection: "internal", access: "protected", requiredScopes: ["not a scope"] }],
  }), /monitor.*invalid scope/i);
  assert.throws(() => defineFeedbackCollections({
    collections: ["internal"],
    submissions: [{ collection: "internal", access: "public", destination: "caller" }],
  }), /submission.*fixed/i);
});

test("rejects duplicate generated submission tool names", () => {
  assert.throws(() => defineFeedbackCollections({
    collections: ["team.one", "team-one"],
    submissions: [
      { collection: "team.one", access: "public" },
      { collection: "team-one", access: "public" },
    ],
  }), /duplicate submission tool name/i);
});
