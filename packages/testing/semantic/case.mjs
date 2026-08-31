import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export function validateSemanticCase(value) {
  if (!value || typeof value !== "object") throw new Error("Semantic test needs options");
  for (const key of ["question", "criteria"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`${key} must be text`);
  }
  if (!(value.server instanceof URL) || value.server.protocol !== "file:") throw new Error("server must be a file URL");
  for (const key of ["criticalFacts", "requiredPaths"]) {
    if (!Array.isArray(value[key]) || !value[key].length || value[key].some((item) =>
      !(key === "criticalFacts" && item instanceof RegExp) && (typeof item !== "string" || !item.trim()))) {
      throw new Error(`${key} must contain text${key === "criticalFacts" ? " or regular expressions" : ""}`);
    }
  }
  if (typeof value.exercise !== "function") throw new Error("exercise must be a function");
  if (value.assertAnswer !== undefined && typeof value.assertAnswer !== "function") throw new Error("assertAnswer must be a function");
  if (value.requiredPaths.some((path) => !/^(tools\/call|resources\/read|prompts\/get):.+$/.test(path))) {
    throw new Error("requiredPaths must name a supported MCP method and target");
  }
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
