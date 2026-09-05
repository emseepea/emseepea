import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function validateConversationOptions(value) {
  if (!value || typeof value !== "object") throw new Error("Conversation needs options");
  if (!(value.server instanceof URL) || value.server.protocol !== "file:") {
    throw new Error("server must be a file URL");
  }
  if (value.context !== undefined && typeof value.context !== "string") {
    throw new Error("context must be text");
  }
  for (const key of ["authToken", "authTokenEnvironment"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) {
      throw new Error(`${key} must be non-empty text`);
    }
  }
  if (value.authToken !== undefined && value.authTokenEnvironment !== undefined) {
    throw new Error("Choose one authentication source");
  }
  if (value.environment !== undefined && (!value.environment || typeof value.environment !== "object"
    || Array.isArray(value.environment)
    || Object.values(value.environment).some((item) => typeof item !== "string"))) {
    throw new Error("environment must contain string values");
  }
  const server = fileURLToPath(value.server);
  return { ...value, server, directory: dirname(server) };
}

export function parseToolSelection(output, advertisedTools) {
  let plan;
  try { plan = JSON.parse(output); } catch { throw new Error("Tool selection must be valid JSON"); }
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).join(",") !== "calls"
    || !Array.isArray(plan.calls) || plan.calls.length > 3) {
    throw new Error("Tool selection must contain between zero and three calls");
  }
  const advertised = new Set(advertisedTools.map(({ name }) => name));
  return plan.calls.map((call) => {
    if (!call || typeof call !== "object" || Array.isArray(call)
      || Object.keys(call).sort().join(",") !== "arguments,name"
      || typeof call.name !== "string" || !advertised.has(call.name)
      || !call.arguments || typeof call.arguments !== "object" || Array.isArray(call.arguments)) {
      throw new Error("Tool selection contains an invalid or unadvertised call");
    }
    return { name: call.name, arguments: call.arguments };
  });
}
