import { createHash } from "node:crypto";
import { resourceHelperOperation } from "./resources.mjs";
import {
  canonicalToolNames,
  normalizeToolSelectionContract,
  toolSelectionContractSatisfied,
} from "./selection.mjs";

const negativeFeedbackObservations = new Set([
  "error",
  "friction",
  "annoyance",
  "unnecessary_difficulty",
  "confusion",
  "repetition",
  "unexpected_bad_result",
  "capability_mismatch",
]);

const sha256 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function validRecord(record, evidence) {
  const { authoritative, smoke } = evidence;
  const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (record.nativeResources !== undefined && typeof record.nativeResources !== "boolean") return false;
  if (record.status !== "passed" || record.authoritative !== authoritative || record.smoke !== smoke
    || record.provider !== evidence.provider || record.configuredModel !== evidence.configuredModel
    || record.modelEvidence !== evidence.modelEvidence
    || JSON.stringify(record.settings) !== JSON.stringify(evidence.settings)
    || record.mode !== "conversation" || record.answerTrials?.length !== 3
    || !Number.isInteger(record.judgeVerdicts?.length) || record.judgeVerdicts.length < 9
    || record.judgeVerdicts.length % 3 !== 0
    || !record.judgeVerdicts.every((judgment) => isHash(judgment.expectationSha256)
      && isHash(judgment.requestSha256) && isHash(judgment.responseSha256)
      && typeof judgment.expectedMeaning === "string" && judgment.expectedMeaning.length > 0
      && judgment.verdict?.pass === true && judgment.verdict.score === 1
      && typeof judgment.verdict.reason === "string" && judgment.verdict.reason.length > 0)) return false;
  return record.answerTrials.every((trial) => Array.isArray(trial.turns) && trial.turns.length > 0
    && trial.turns.every((turn) => Number.isInteger(turn.advertisedToolCount)
      && turn.advertisedToolCount >= 0
      && turn.interactionMode === "native-mcp"
      && turn.answerTurnCount === 1
      && turn.answerProviderToolCount === turn.toolCallCount
      && Number.isInteger(turn.answerProviderTurnCount) && turn.answerProviderTurnCount >= 1
      && Number.isInteger(turn.toolCallCount) && turn.toolCallCount >= 0
      && typeof turn.prompt === "string" && turn.prompt.length > 0
      && typeof turn.response === "string"
      && isHash(turn.promptSha256) && isHash(turn.answerSha256)
      && isHash(turn.advertisedToolsSha256) && isHash(turn.selectedCallsSha256)
      && Array.isArray(turn.toolCalls) && turn.toolCalls.length === turn.toolCallCount
      && turn.selectedCallsSha256 === sha256(turn.toolCalls.map(({ name, arguments: args }) => ({
        name,
        arguments: args,
      })))
      && JSON.stringify(turn.selectedTools)
        === JSON.stringify(turn.toolCalls.map(({ name }) => name))
      && validToolAssertions(turn, isHash)
      && validNegativeFeedbackAssertion(turn)
      && validFeedbackDisclosure(turn, record.judgeVerdicts, trial.trial, isHash)
      && turn.toolCalls.every((call) => Object.hasOwn(call, "result") && typeof call.isError === "boolean")
      && validPathEvidence(turn, record, trial, isHash)));
}

function validPathEvidence(turn, record, trial, isHash) {
  const operations = turn.resourceOperations ?? [];
  if (!Array.isArray(operations)) return false;
  if (record.nativeResources !== true) {
    if (operations.length) return false;
  } else {
    const catalogue = trial.resourceCatalogue;
    if (!record.provider.startsWith("codex-") || !catalogue
      || !Array.isArray(catalogue.resources) || !Array.isArray(catalogue.resourceTemplates)
      || catalogue.resources.length > 4096 || catalogue.resourceTemplates.length > 4096
      || !catalogue.resources.every(entry => entry && typeof entry.uri === "string" && entry.uri.trim())
      || !catalogue.resourceTemplates.every(entry => entry && typeof entry.uriTemplate === "string" && entry.uriTemplate.trim())
      || Buffer.byteLength(JSON.stringify(catalogue)) > 2 * 1_048_576
      || !isHash(turn.resourceCatalogueSha256) || turn.resourceCatalogueSha256 !== sha256(catalogue)
      || turn.answerProviderResourceOperationCount !== operations.length
      || turn.answerProviderTurnCount !== turn.toolCallCount + operations.length + 1
      || !isHash(turn.materialSha256) || turn.materialSha256 !== sha256(turn.pathEvidence)) return false;
    const helpers = { "resources/read": "read_mcp_resource", "resources/list": "list_mcp_resources",
      "resources/templates/list": "list_mcp_resource_templates" };
    try {
      for (const operation of operations) {
        if (!operation || operation.source !== "provider-native-helper"
          || Object.keys(operation).some(key => !["method", "target", "arguments", "result", "source"].includes(key))) return false;
        const checked = resourceHelperOperation({ server: "emseepea_eval", status: "completed",
          tool: helpers[operation.method], arguments: operation.arguments,
          result: { content: [{ type: "text", text: JSON.stringify(operation.result) }], structured_content: null } }, catalogue);
        if (!checked || checked.method !== operation.method || checked.target !== operation.target) return false;
      }
    } catch { return false; }
  }
  if (!Array.isArray(turn.pathEvidence) || turn.pathEvidence.length !== turn.toolCallCount + operations.length) return false;
  let toolIndex = 0, resourceIndex = 0;
  for (const path of turn.pathEvidence) {
    if (!path || typeof path !== "object" || Array.isArray(path)) return false;
    if (path.method === "tools/call") {
      const call = turn.toolCalls[toolIndex++];
      if (!call || path.target !== call.name
        || path.requestSha256 !== sha256({ method: path.method, name: call.name, arguments: call.arguments })
        || path.responseSha256 !== sha256(call.result)) return false;
    } else {
      const operation = operations[resourceIndex++];
      if (!operation || path.source !== "provider-native-helper" || path.method !== operation.method
        || path.target !== operation.target || path.requestSha256 !== sha256(operation.arguments)
        || path.responseSha256 !== sha256(operation.result)) return false;
    }
  }
  return toolIndex === turn.toolCallCount && resourceIndex === operations.length;

}

function validToolAssertions(turn, isHash) {
  if (turn.expectedOptionalFeedback === true) {
    if (!Array.isArray(turn.expectedCalls)) return false;
    const expectedHash = createHash("sha256").update(JSON.stringify({
      calls: turn.expectedCalls,
      optionalFeedback: true,
    })).digest("hex");
    const calls = turn.toolCalls.map(({ name, arguments: args }) => ({ name, arguments: args }));
    const primaryCalls = calls.slice(0, turn.expectedCalls?.length);
    const trailingCalls = calls.slice(turn.expectedCalls?.length);
    return expectedHash === turn.expectedSelectionSha256
      && JSON.stringify(primaryCalls) === JSON.stringify(turn.expectedCalls)
      && (trailingCalls.length === 0
        || (trailingCalls.length === 1 && trailingCalls[0].name === "submit-feedback"));
  }
  if (typeof turn.expectedOptionalTool === "string" && turn.expectedOptionalTool.trim()) {
    const expectedHash = createHash("sha256").update(JSON.stringify({
      optionalTool: turn.expectedOptionalTool,
    })).digest("hex");
    return expectedHash === turn.expectedSelectionSha256
      && (turn.toolCalls.length === 0
        || (turn.toolCalls.length === 1 && turn.toolCalls[0].name === turn.expectedOptionalTool));
  }
  if (turn.expectedToolSelection !== undefined) {
    const advertised = turn.advertisedToolNames;
    if (!Array.isArray(advertised) || advertised.length !== turn.advertisedToolCount
      || advertised.some((name) => typeof name !== "string" || !name.trim())
      || JSON.stringify(advertised) !== JSON.stringify(canonicalToolNames(new Set(advertised)))
      || !isHash(turn.advertisedToolNamesSha256)
      || turn.advertisedToolNamesSha256 !== createHash("sha256")
        .update(JSON.stringify(advertised)).digest("hex")
      || !isHash(turn.expectedToolSelectionSha256)
      || !isHash(turn.toolOutcomesSha256)
      || turn.toolOutcomesSha256 !== createHash("sha256")
        .update(JSON.stringify(turn.toolCalls)).digest("hex")) return false;
    let normalized;
    try {
      normalized = normalizeToolSelectionContract(turn.expectedToolSelection, advertised);
    } catch {
      return false;
    }
    if (JSON.stringify(normalized) !== JSON.stringify(turn.expectedToolSelection)
      || turn.expectedToolSelectionSha256 !== createHash("sha256")
        .update(JSON.stringify(normalized)).digest("hex")) return false;
    return toolSelectionContractSatisfied(normalized, turn.toolCalls)
      && validOutcomeAssertions(turn, "expectedOutcomeAssertionsSha256");
  }
  if (JSON.stringify(turn.selectedTools) !== JSON.stringify(turn.expectedTools)) return false;
  if (turn.expectedToolAlternatives !== undefined) {
    const alternatives = turn.expectedToolAlternatives;
    if (!Array.isArray(alternatives) || alternatives.length < 1 || alternatives.length > 8
      || !alternatives.every((names) => Array.isArray(names)
        && names.every((name) => typeof name === "string" && name.trim()))
      || !alternatives.some((names) => JSON.stringify(names) === JSON.stringify(turn.expectedTools))) {
      return false;
    }
  }
  if (isHash(turn.expectedCallsSha256)) {
    return JSON.stringify(turn.toolCalls.map(({ name, arguments: args }) => ({ name, arguments: args })))
      === JSON.stringify(turn.expectedCalls);
  }
  return validOutcomeAssertions(turn, "expectedSelectionSha256", true, isHash);
}

function validOutcomeAssertions(turn, digestField, includeTools = false, isHash = (value) => (
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
)) {
  const hasAssertions = turn.expectedArguments !== undefined || turn.expectedFeedback !== undefined;
  if (!includeTools && !hasAssertions) return turn[digestField] === undefined;
  if (!isHash(turn[digestField])) return false;
  const expectedHash = createHash("sha256").update(JSON.stringify({
    ...(includeTools ? { tools: turn.expectedTools } : {}),
    arguments: turn.expectedArguments,
    feedback: turn.expectedFeedback,
    ...(!includeTools || turn.expectedToolAlternatives === undefined
      ? {} : { alternatives: turn.expectedToolAlternatives }),
  })).digest("hex");
  if (expectedHash !== turn[digestField]) return false;
  for (const [name, expected] of Object.entries(turn.expectedArguments ?? {})) {
    const matches = turn.toolCalls.filter((call) => call.name === name);
    if (matches.length !== 1 || JSON.stringify(matches[0].arguments) !== JSON.stringify(expected)) return false;
  }
  if (turn.expectedFeedback) {
    const calls = turn.toolCalls.filter((call) => call.name === "submit-feedback");
    const detail = calls[0]?.arguments?.detail;
    if (calls.length !== 1 || !turn.expectedFeedback.observation.includes(calls[0].arguments?.observation)
      || typeof detail !== "string" || turn.expectedFeedback.detailIncludes.some(
        (value) => !detail.toLowerCase().includes(value.toLowerCase()),
      )) return false;
  }
  return true;
}

function validNegativeFeedbackAssertion(turn) {
  if (turn.expectedNegativeFeedback !== false) return true;
  const actual = turn.toolCalls.filter((call) => call.name === "submit-feedback"
    && negativeFeedbackObservations.has(call.arguments?.observation));
  return actual.length === 0 && JSON.stringify(actual) === JSON.stringify(turn.negativeFeedbackCalls);
}

function validFeedbackDisclosure(turn, judgments, trial, isHash) {
  if (turn.expectedOptionalFeedback !== true) return turn.feedbackDisclosure === undefined;
  const feedback = turn.toolCalls[turn.expectedCalls.length];
  if (!feedback) return turn.feedbackDisclosure === undefined;
  if (feedback.isError || typeof feedback.arguments?.observation !== "string"
    || !feedback.arguments.observation.trim() || typeof feedback.arguments.detail !== "string"
    || !feedback.arguments.detail.trim()) return false;
  const expectedMeaning = feedbackDisclosureExpectation(feedback);
  const expectationSha256 = createHash("sha256").update(expectedMeaning).digest("hex");
  if (!isHash(turn.feedbackDisclosure?.expectationSha256)
    || JSON.stringify(turn.feedbackDisclosure) !== JSON.stringify({
      observation: feedback.arguments.observation,
      detail: feedback.arguments.detail,
      expectationSha256,
    })) return false;
  const matching = judgments.filter((judgment) => judgment.trial === trial
    && judgment.turn === turn.turn && judgment.expectationSha256 === expectationSha256);
  return matching.length === 3 && matching.every((judgment) =>
    judgment.expectedMeaning === expectedMeaning && judgment.verdict?.pass === true);
}

function feedbackDisclosureExpectation(call) {
  return "The final assistant response makes it clear that feedback was submitted, recorded, or noted, "
    + "and communicates the substance "
    + `of this specific ${call.arguments.observation} observation: ${call.arguments.detail} `
    + "A concise, faithful summary is enough. It need not repeat every example, field, or phrase.";
}
