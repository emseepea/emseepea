import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { validRecord } from "../semantic/evidence.mjs";
import { providerSettings } from "../semantic/provider.mjs";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function fixture(provider) {
  const evidence = {
    authoritative: true, smoke: false, provider,
    configuredModel: provider === "claude-ci" ? "claude-sonnet-4-6" : "gpt-test",
    modelEvidence: provider === "claude-ci" ? "observed" : "configured",
    settings: providerSettings(provider),
  };
  const toolCalls = Array.from({ length: 40 }, (_, index) => ({
    name: "read-record", arguments: { id: index }, result: { id: index }, isError: false,
  }));
  const selectedTools = toolCalls.map(({ name }) => name);
  const turn = {
    advertisedToolCount: 1, interactionMode: "native-mcp", answerTurnCount: 1,
    answerProviderToolCount: 40, answerProviderTurnCount: 2, toolCallCount: 40,
    prompt: "Read all forty records.", response: "All forty records were read.",
    promptSha256: hash("Read all forty records."), answerSha256: hash("All forty records were read."),
    advertisedToolsSha256: hash(["read-record"]),
    selectedCallsSha256: hash(toolCalls.map(({ name, arguments: args }) => ({ name, arguments: args }))),
    toolCalls, selectedTools, expectedTools: selectedTools,
    expectedSelectionSha256: hash({ tools: selectedTools }),
    pathEvidence: toolCalls.map(({ name, arguments: args, result }) => ({
      method: "tools/call", target: name,
      requestSha256: hash({ method: "tools/call", name, arguments: args }), responseSha256: hash(result),
    })),
  };
  const record = {
    ...evidence, status: "passed", mode: "conversation",
    answerTrials: Array.from({ length: 3 }, (_, index) => ({ trial: index + 1, turns: [structuredClone(turn)] })),
    judgeVerdicts: Array.from({ length: 9 }, (_, index) => ({
      trial: Math.floor(index / 3) + 1, judgment: index % 3 + 1,
      expectedMeaning: "All forty records were read.", expectationSha256: hash("All forty records were read."),
      requestSha256: hash(index), responseSha256: hash({ pass: true }),
      verdict: { pass: true, score: 1, reason: "All records are present." },
    })),
  };
  return { evidence, record };
}

test("the CLI evidence validator accepts more than three calls without imposing a round-count formula", () => {
  for (const provider of ["claude-ci", "codex-ci"]) {
    const { evidence, record } = fixture(provider);
    assert.equal(validRecord(record, evidence), true);
    record.answerTrials[0].turns[0].answerProviderTurnCount = 41;
    assert.equal(validRecord(record, evidence), true);
  }
});

test("removing the CLI call ceiling preserves complete, consistent evidence and independent judgments", () => {
  const mutations = [
    (record) => { record.answerTrials[0].turns[0].toolCallCount = 39; },
    (record) => { record.answerTrials[0].turns[0].answerProviderToolCount = 39; },
    (record) => { record.answerTrials[0].turns[0].answerProviderTurnCount = 0; },
    (record) => { record.answerTrials[0].turns[0].pathEvidence.pop(); },
    (record) => { record.answerTrials[0].turns[0].expectedTools = ["other-tool"]; },
    (record) => { record.answerTrials[0].turns[0].pathEvidence[0].responseSha256 = "invalid"; },
    (record) => { record.judgeVerdicts.pop(); },
    (record) => { record.judgeVerdicts[0].verdict.pass = false; },
  ];
  for (const mutate of mutations) {
    const { evidence, record } = fixture("claude-ci");
    mutate(record);
    assert.equal(validRecord(record, evidence), false);
  }
});

test("outcome-constrained selection evidence is canonical and independently revalidated", () => {
  const contract = {
    required: [{ name: "read-record", minCalls: 1, maxCalls: 40 }],
    allowed: [],
    forbidden: [],
    totalCalls: { minCalls: 1, maxCalls: 40 },
  };
  const selectionFixture = ({ withArgument = false } = {}) => {
    const value = fixture("claude-ci");
    for (const { turns } of value.record.answerTrials) {
      const turn = turns[0];
      if (withArgument) {
        turn.toolCalls = [turn.toolCalls[0]];
        turn.selectedTools = ["read-record"];
        turn.toolCallCount = 1;
        turn.answerProviderToolCount = 1;
        turn.selectedCallsSha256 = hash([{ name: "read-record", arguments: { id: 0 } }]);
        turn.pathEvidence = [turn.pathEvidence[0]];
      }
      delete turn.expectedTools;
      delete turn.expectedSelectionSha256;
      turn.expectedToolSelection = withArgument ? {
        ...structuredClone(contract),
        required: [{ name: "read-record", minCalls: 1, maxCalls: 1 }],
        totalCalls: { minCalls: 1, maxCalls: 1 },
      } : structuredClone(contract);
      turn.expectedToolSelectionSha256 = hash(turn.expectedToolSelection);
      turn.toolOutcomesSha256 = hash(turn.toolCalls);
      turn.advertisedToolNames = ["read-record"];
      turn.advertisedToolNamesSha256 = hash(["read-record"]);
      if (withArgument) {
        turn.expectedArguments = { "read-record": { id: 0 } };
        turn.expectedOutcomeAssertionsSha256 = hash({ arguments: turn.expectedArguments });
      }
    }
    return value;
  };
  assert.equal(validRecord(selectionFixture().record, selectionFixture().evidence), true);
  assert.equal(validRecord(selectionFixture({ withArgument: true }).record,
    selectionFixture({ withArgument: true }).evidence), true);
  const mutations = [
    (turn) => { turn.expectedToolSelection.required[0].maxCalls = 39; },
    (turn) => { turn.expectedToolSelectionSha256 = "0".repeat(64); },
    (turn) => { turn.toolOutcomesSha256 = "0".repeat(64); },
    (turn) => { turn.expectedToolSelection.required.push({ name: "other", minCalls: 1, maxCalls: 1 }); },
    (turn) => { turn.advertisedToolNames = ["other"]; },
    (turn) => { turn.advertisedToolNamesSha256 = "0".repeat(64); },
    (turn) => { turn.toolCalls.push(structuredClone(turn.toolCalls[0])); },
    (turn) => { turn.toolCalls[0].result = { id: "fabricated" }; },
    (turn) => { turn.toolCalls[0].isError = true; },
    (turn) => { turn.toolCalls[0].arguments.id = "fabricated"; },
    (turn) => { turn.pathEvidence[0].target = "other"; },
  ];
  for (const mutate of mutations) {
    const { evidence, record } = selectionFixture();
    mutate(record.answerTrials[0].turns[0]);
    assert.equal(validRecord(record, evidence), false);
  }
  const outcomeMutations = [
    (turn) => { delete turn.expectedArguments; },
    (turn) => { delete turn.expectedOutcomeAssertionsSha256; },
    (turn) => { turn.expectedArguments["read-record"].id = 1; },
    (turn) => { turn.expectedOutcomeAssertionsSha256 = "0".repeat(64); },
  ];
  for (const mutate of outcomeMutations) {
    const { evidence, record } = selectionFixture({ withArgument: true });
    mutate(record.answerTrials[0].turns[0]);
    assert.equal(validRecord(record, evidence), false);
  }
});
