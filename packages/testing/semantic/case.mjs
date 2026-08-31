import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export function validateSemanticCase(value) {
  const result = validateCommon(value);
  if (typeof value.exercise !== "function") throw new Error("exercise must be a function");
  if (!Array.isArray(value.requiredPaths) || !value.requiredPaths.length || value.requiredPaths.some((path) =>
    typeof path !== "string" || !/^(tools\/call|resources\/read|prompts\/get):.+$/.test(path))) {
    throw new Error("requiredPaths must name a supported MCP method and target");
  }
  return result;
}

export function validateToolSelectionCase(value) {
  const result = validateCommon(value);
  if (!Array.isArray(value.expectedTools) || value.expectedTools.length < 1 || value.expectedTools.length > 3
    || value.expectedTools.some((name) => typeof name !== "string" || !name.trim())) {
    throw new Error("expectedTools must name between one and three tool calls");
  }
  if (value.exercise !== undefined || value.requiredPaths !== undefined) {
    throw new Error("toolSelectionTest chooses calls from expectedTools; do not provide exercise or requiredPaths");
  }
  return {
    ...result,
    expectedTools: [...value.expectedTools],
    requiredPaths: [...new Set(value.expectedTools.map((name) => `tools/call:${name}`))],
  };
}

export function parseToolSelection(output, advertisedTools, expectedTools) {
  let plan;
  try { plan = JSON.parse(output); } catch { throw new Error("Tool selection must be valid JSON"); }
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).join(",") !== "calls"
    || !Array.isArray(plan.calls) || plan.calls.length < 1 || plan.calls.length > 3) {
    throw new Error("Tool selection must contain between one and three calls");
  }
  const advertised = new Set(advertisedTools.map(({ name }) => name));
  const calls = plan.calls.map((call) => {
    if (!call || typeof call !== "object" || Array.isArray(call)
      || Object.keys(call).sort().join(",") !== "arguments,name"
      || typeof call.name !== "string" || !advertised.has(call.name)
      || !call.arguments || typeof call.arguments !== "object" || Array.isArray(call.arguments)) {
      throw new Error("Tool selection contains an invalid or unadvertised call");
    }
    return { name: call.name, arguments: call.arguments };
  });
  if (calls.map(({ name }) => name).join("\n") !== expectedTools.join("\n")) {
    throw new Error("Model selected the wrong tool sequence");
  }
  return calls;
}

function validateCommon(value) {
  if (!value || typeof value !== "object") throw new Error("Semantic test needs options");
  for (const key of ["question", "criteria"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`${key} must be text`);
  }
  if (!(value.server instanceof URL) || value.server.protocol !== "file:") throw new Error("server must be a file URL");
  if (!Array.isArray(value.criticalFacts) || !value.criticalFacts.length || value.criticalFacts.some((item) =>
    !(item instanceof RegExp) && (typeof item !== "string" || !item.trim()))) {
    throw new Error("criticalFacts must contain text or regular expressions");
  }
  if (value.assertAnswer !== undefined && typeof value.assertAnswer !== "function") throw new Error("assertAnswer must be a function");
  for (const key of ["authToken", "authTokenEnvironment"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) throw new Error(`${key} must be non-empty text`);
  }
  if (value.authToken !== undefined && value.authTokenEnvironment !== undefined) throw new Error("Choose one authentication source");
  if (value.environment !== undefined && (!value.environment || typeof value.environment !== "object" ||
    Array.isArray(value.environment) || Object.values(value.environment).some((item) => typeof item !== "string"))) {
    throw new Error("environment must contain string values");
  }
  const server = fileURLToPath(value.server);
  return { ...value, server, directory: dirname(server) };
}

export function checkMeaningEvidence(options, answer, paths) {
  const seen = new Set(paths.map(({ method, target }) => `${method}:${target}`));
  if (options.requiredPaths.some((path) => !seen.has(path))) throw new Error("Required MCP path evidence is missing");
  const missingFactIndices = options.criticalFacts.flatMap((fact, index) =>
    (fact instanceof RegExp ? new RegExp(fact.source, fact.flags).test(answer)
      : answer.toLowerCase().includes(fact.toLowerCase())) ? [] : [index]);
  if (missingFactIndices.length) {
    throw Object.assign(new Error("Answer is missing a required fact"), {
      code: "missing-critical-facts", missingFactIndices,
    });
  }
}
