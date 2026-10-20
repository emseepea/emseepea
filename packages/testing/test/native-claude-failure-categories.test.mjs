import assert from "node:assert/strict";
import test from "node:test";
import { parseNativeClaudeEvents } from "../semantic/provider.mjs";

const privatePayload = "SYNTHETIC_PAYLOAD_MUST_NOT_APPEAR_IN_ERRORS";
const init = { type: "system", subtype: "init", tools: [], mcp_servers: [] };
const result = {
  type: "result", is_error: false, num_turns: 1, permission_denials: [],
  result: privatePayload,
  modelUsage: { "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" } },
};

test("native Claude still accepts a valid text answer", () => {
  assert.equal(parseNativeClaudeEvents([init, result], [], true).answer, privatePayload);
});

const failures = [
  ["missing result", [init], "Model command omitted its result event"],
  ["execution error", [init, { ...result, is_error: true, subtype: "error_during_execution" }], "Model command failed during execution"],
  ["budget error", [init, { ...result, is_error: true, subtype: "error_max_budget_usd" }], "Model command exceeded its budget"],
  ["turn limit error", [init, { ...result, is_error: true, subtype: "error_max_turns" }], "Model command exceeded its turn limit"],
  ["unknown error subtype", [init, { ...result, is_error: true, subtype: privatePayload }], "Model command reported an error"],
  ["null result field", [init, { ...result, result: null }], "Model command returned a non-text answer"],
  ["object result field", [init, { ...result, result: { private: privatePayload } }], "Model command returned a non-text answer"],
  ["authentication precedence", [init, { ...result, is_error: true, result: "Failed to authenticate: OAuth session expired" }], "Model command is not signed in"],
  ["initialization precedence", [result], "Model command omitted MCP initialization evidence"],
  ["turn count validation", [init, { ...result, num_turns: 0 }], "Model command returned an invalid turn count"],
  ["required model validation", [init, { ...result, modelUsage: {} }], "Model command did not use the required model"],
];

for (const [name, events, message] of failures) {
  test(`native Claude rejects ${name} with a safe category`, () => {
    assert.throws(() => parseNativeClaudeEvents(structuredClone(events), [], true), (error) => {
      assert.equal(error.constructor, Error);
      assert.equal(error.message, message);
      assert.ok(!error.message.includes(privatePayload));
      assert.ok(!JSON.stringify(error).includes(privatePayload));
      return true;
    });
  });
}
