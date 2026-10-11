import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeToolSelectionContract,
  toolSelectionContractSatisfied,
} from "../semantic/selection.mjs";

const advertised = ["begin-subject-research", "list-practice", "record-subject-research", "start-practice"];
const authored = {
  required: [
    { name: "record-subject-research", minCalls: 1, maxCalls: 1 },
    { name: "start-practice", minCalls: 1, maxCalls: 2 },
    { name: "list-practice", minCalls: 1, maxCalls: 1 },
  ],
  allowed: [{ name: "begin-subject-research", maxCalls: 1 }],
  forbidden: [],
  totalCalls: { minCalls: 3, maxCalls: 5 },
};

test("selection contracts normalize independently of authored order", () => {
  const normalized = normalizeToolSelectionContract(authored, advertised);
  assert.deepEqual(normalized, {
    required: [
      { name: "list-practice", minCalls: 1, maxCalls: 1 },
      { name: "record-subject-research", minCalls: 1, maxCalls: 1 },
      { name: "start-practice", minCalls: 1, maxCalls: 2 },
    ],
    allowed: [{ name: "begin-subject-research", maxCalls: 1 }],
    forbidden: [],
    totalCalls: { minCalls: 3, maxCalls: 5 },
  });
  assert.notEqual(normalized, authored);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.required));
  assert.ok(Object.isFrozen(normalized.required[0]));
});

test("canonical tool ordering does not depend on the host locale", () => {
  const names = ["ä-tool", "z-tool", "_tool", "A-tool"];
  const normalized = normalizeToolSelectionContract({
    required: names.map((toolName) => ({ name: toolName, minCalls: 1, maxCalls: 1 })),
    allowed: [],
    totalCalls: { minCalls: 4, maxCalls: 4 },
  }, names);
  assert.deepEqual(normalized.required.map(({ name }) => name), ["A-tool", "_tool", "z-tool", "ä-tool"]);
});

test("the explicit forbidden list is optional and omitted tools stay forbidden", () => {
  const withoutForbidden = structuredClone(authored);
  delete withoutForbidden.forbidden;
  const normalized = normalizeToolSelectionContract(withoutForbidden, advertised);
  assert.deepEqual(normalized.forbidden, []);
  assert.equal(toolSelectionContractSatisfied(normalized, [{ name: "unadvertised-tool" }]), false);
});

test("selection contracts accept different valid completed paths", () => {
  const contract = normalizeToolSelectionContract(authored, advertised);
  assert.equal(toolSelectionContractSatisfied(contract, [
    { name: "list-practice" },
    { name: "start-practice" },
    { name: "record-subject-research" },
  ]), true);
  assert.equal(toolSelectionContractSatisfied(contract, [
    { name: "begin-subject-research" },
    { name: "record-subject-research" },
    { name: "list-practice" },
    { name: "start-practice" },
    { name: "start-practice" },
  ]), true);
});

test("selection contracts reject calls outside the declared outcome", () => {
  const contract = normalizeToolSelectionContract(authored, [...advertised, "delete-subject"]);
  for (const calls of [
    [{ name: "list-practice" }, { name: "record-subject-research" }],
    [{ name: "list-practice" }, { name: "start-practice" }, { name: "record-subject-research" }, { name: "delete-subject" }],
    [{ name: "list-practice" }, { name: "start-practice" }, { name: "record-subject-research" }, { name: "record-subject-research" }],
  ]) {
    assert.equal(toolSelectionContractSatisfied(contract, calls), false);
  }
  const explicitlyForbidden = normalizeToolSelectionContract({
    ...authored,
    forbidden: ["delete-subject"],
  }, [...advertised, "delete-subject"]);
  assert.equal(toolSelectionContractSatisfied(explicitlyForbidden, [
    { name: "list-practice" },
    { name: "start-practice" },
    { name: "record-subject-research" },
    { name: "delete-subject" },
  ]), false);
});

test("selection contracts reject malformed, conflicting, vacuous, and impossible rules", () => {
  const invalid = [
    {},
    { ...authored, unexpected: true },
    { ...authored, required: [] },
    { ...authored, required: [{ name: "missing", minCalls: 1, maxCalls: 1 }] },
    { ...authored, allowed: [{ name: "start-practice", maxCalls: 1 }] },
    { ...authored, forbidden: ["start-practice"] },
    { ...authored, required: [{ name: "start-practice", minCalls: 2, maxCalls: 1 }] },
    { ...authored, totalCalls: { minCalls: 6, maxCalls: 6 } },
    { ...authored, totalCalls: { minCalls: 3, maxCalls: Number.MAX_SAFE_INTEGER + 1 } },
  ];
  for (const contract of invalid) {
    assert.throws(() => normalizeToolSelectionContract(contract, advertised));
  }
});
