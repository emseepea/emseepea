#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import {
  assertPublishedMcpContractCompatible,
  extractPublishedMcpContract,
  startEmseepea,
  writePublishedMcpContractBaseline,
} from "../dist/index.js";

const protocolVersions = new Set([
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
]);

class CommandError extends Error {
  constructor(exitCode, text) {
    super(text);
    this.exitCode = exitCode;
  }
}

if (process.argv.includes("--help")) {
  console.log(usage());
} else {
  let secret;
  try {
    const options = parse(process.argv.slice(2));
    secret = options.tokenEnv ? process.env[options.tokenEnv] : undefined;
    if (options.tokenEnv && !secret) fail(`Environment variable ${options.tokenEnv} is empty or unset`);
    const current = await currentContract(options, secret);
    if (options.command === "capture") {
      await writePublishedMcpContractBaseline(options.baseline, { version: options.version, contract: current });
      console.log(`Captured published MCP contract ${options.version} at ${options.baseline}`);
    } else {
      const inputs = await loadBaselineInputs(options.baselines, !options.policy);
      if (options.policy) {
        const breaks = await checkWithPolicy(options.policy, current, inputs);
        if (breaks.length > 0) throw new CommandError(1, compatibilityMessage(breaks));
      } else {
        const baselines = loadBaselines(inputs);
        try {
          assertPublishedMcpContractCompatible(current, baselines);
        } catch (error) {
          throw new CommandError(1, message(error));
        }
      }
      console.log(`Published MCP contract is compatible with ${inputs.length} baseline(s)`);
    }
  } catch (error) {
    console.error(redact(message(error), secret));
    process.exitCode = error instanceof CommandError ? error.exitCode : 2;
  }
}

async function currentContract(options, token) {
  if (options.factory) {
    const imported = await import(pathToFileURL(resolve(options.factory)).href);
    const factory = imported[options.factoryExport];
    if (typeof factory !== "function") fail(`${options.factory} does not export ${options.factoryExport} as a function`);
    const running = await startEmseepea(await factory(), {
      clientName: "emseepea-contract",
      protocolVersion: options.protocolVersion,
      token,
    });
    try {
      return await extractPublishedMcpContract(await running.connect());
    } finally {
      await running.close();
    }
  }

  const client = new Client(
    { name: "emseepea-contract", version: "0.0.0" },
    options.protocolVersion === "2026-07-28"
      ? { versionNegotiation: { mode: { pin: options.protocolVersion } } }
      : { supportedProtocolVersions: [options.protocolVersion], versionNegotiation: { mode: "legacy" } },
  );
  try {
    await client.connect(new StreamableHTTPClientTransport(
      new URL(options.url),
      token ? { authProvider: { token: async () => token } } : undefined,
    ));
    return await extractPublishedMcpContract(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function loadBaselineInputs(directory, validate) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (entries.length === 0) fail(`No JSON baselines found in ${directory}`);
  const baselines = [];
  for (const name of entries) {
    const file = resolve(directory, name);
    const value = JSON.parse(await readFile(file, "utf8"));
    if (validate && !isBaseline(value)) fail(`Invalid published MCP contract baseline: ${file}`);
    baselines.push({ file, value });
  }
  return baselines;
}

function loadBaselines(inputs) {
  return inputs.map(({ value }) => value);
}

async function checkWithPolicy(file, current, baselines) {
  const imported = await import(pathToFileURL(resolve(file)).href);
  const policy = imported.checkPublishedMcpContracts;
  if (typeof policy !== "function") fail(`${file} does not export checkPublishedMcpContracts as a function`);
  const breaks = await policy({ current, baselines });
  if (!Array.isArray(breaks)) fail(`${file} returned an invalid compatibility break list`);
  for (const entry of breaks) {
    if (!isBreak(entry)) fail(`${file} returned an invalid compatibility break`);
  }
  return breaks;
}

function parse(argv) {
  const command = argv.shift();
  if (command !== "capture" && command !== "check") fail(usage());
  const values = new Map();
  while (argv.length > 0) {
    const option = argv.shift();
    if (!option?.startsWith("--")) fail(`Unexpected argument: ${String(option)}`);
    if (values.has(option)) fail(`Duplicate option: ${option}`);
    const value = argv.shift();
    if (!value || value.startsWith("--")) fail(`Missing value for ${option}`);
    values.set(option, value);
  }
  const known = new Set([
    "--factory", "--factory-export", "--url", "--protocol-version", "--token-env",
    "--baseline", "--baselines", "--version", "--policy",
  ]);
  for (const option of values.keys()) if (!known.has(option)) fail(`Unknown option: ${option}`);
  const factory = values.get("--factory");
  const url = values.get("--url");
  if (Boolean(factory) === Boolean(url)) fail("Supply exactly one of --factory or --url");
  if (!factory && values.has("--factory-export")) fail("--factory-export requires --factory");
  if (url) {
    try {
      new URL(url);
    } catch {
      fail(`Invalid MCP URL: ${url}`);
    }
  }
  const protocolVersion = values.get("--protocol-version") ?? "2026-07-28";
  if (!protocolVersions.has(protocolVersion)) fail(`Unsupported protocol version: ${protocolVersion}`);
  const tokenEnv = values.get("--token-env");
  if (tokenEnv && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tokenEnv)) fail(`Invalid environment variable name: ${tokenEnv}`);

  const common = {
    command,
    factory,
    factoryExport: values.get("--factory-export") ?? "createApp",
    url,
    protocolVersion,
    tokenEnv,
  };
  if (command === "capture") {
    const baseline = values.get("--baseline");
    const version = values.get("--version");
    if (!baseline || !version) fail("capture requires --baseline and --version");
    if (values.has("--baselines")) fail("capture does not accept --baselines");
    if (values.has("--policy")) fail("capture does not accept --policy");
    return { ...common, baseline, version };
  }
  const baselines = values.get("--baselines");
  if (!baselines) fail("check requires --baselines");
  if (values.has("--baseline") || values.has("--version")) fail("check does not accept --baseline or --version");
  return { ...common, baselines, policy: values.get("--policy") };
}

function isBaseline(value) {
  return value !== null && typeof value === "object"
    && typeof value.version === "string" && value.version.length > 0
    && value.contract !== null && typeof value.contract === "object"
    && Array.isArray(value.contract.tools) && Array.isArray(value.contract.resources);
}

function isBreak(value) {
  return value !== null && typeof value === "object"
    && typeof value.version === "string"
    && typeof value.kind === "string"
    && typeof value.path === "string"
    && typeof value.detail === "string";
}

function compatibilityMessage(breaks) {
  return [
    `Published MCP contract has ${breaks.length} breaking change(s):`,
    ...breaks.map(({ version, kind, path, detail }) => `- [${version}] [${kind}] ${path}: ${detail}`),
  ].join("\n");
}

function fail(text) {
  throw new CommandError(2, text);
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function redact(text, secret) {
  return secret ? text.replaceAll(secret, "[redacted]") : text;
}

function usage() {
  return [
    "Usage:",
    "  emseepea-contract capture (--factory <module> | --url <mcp-url>) --version <label> --baseline <file> [options]",
    "  emseepea-contract check (--factory <module> | --url <mcp-url>) --baselines <directory> [options]",
    "Options: --factory-export <name> --protocol-version <version> --token-env <name>",
    "Check only: --policy <module>",
  ].join("\n");
}
