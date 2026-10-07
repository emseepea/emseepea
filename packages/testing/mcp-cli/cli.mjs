#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { runMcpCliQualification } from "../dist/mcp-cli-qualification.js";

const values = process.argv.slice(2);
if (values.includes("--help")) {
  console.log("Usage: emseepea-qualify --scenario <module.mjs> --output <evidence.json>");
  process.exit(0);
}

const scenarioPath = option("--scenario");
const output = option("--output");
if (!scenarioPath || !output || values.length !== 4) fail("Expected --scenario and --output");

try {
  const loaded = await import(pathToFileURL(resolve(scenarioPath)).href);
  const scenario = typeof loaded.default === "function" ? await loaded.default() : loaded.default;
  const evidence = await runMcpCliQualification(scenario, resolve(output));
  console.log(`MCP CLI qualification ${evidence.status}; evidence: ${output}`);
  if (evidence.status !== "passed") process.exitCode = 1;
} catch {
  fail("MCP CLI qualification could not run");
}

function option(name) {
  const index = values.indexOf(name);
  if (index < 0 || index === values.length - 1 || values[index + 1].startsWith("--")) return undefined;
  if (values.indexOf(name, index + 1) >= 0) fail(`Duplicate ${name}`);
  return values[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
