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
  if (value.environment !== undefined && typeof value.environment !== "function") {
    validateEnvironment(value.environment);
  }
  const server = fileURLToPath(value.server);
  return { ...value, server, directory: dirname(server) };
}

export function environmentForTrial(environment, trial) {
  const resolved = typeof environment === "function" ? environment(trial) : environment;
  if (resolved === undefined) return undefined;
  validateEnvironment(resolved);
  return resolved;
}

function validateEnvironment(environment) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)
    || Object.values(environment).some((item) => typeof item !== "string")) {
    throw new Error("environment must contain string values");
  }
}
