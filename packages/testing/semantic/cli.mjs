#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSemanticCase, requiredPaths } from "./case.mjs";
import { collectMcpMaterial, startSemanticServer, stopSemanticServer } from "./material.mjs";
import { parseJudgeVerdict, runModel } from "./provider.mjs";

const options = parseArguments(process.argv.slice(2));
const outputPath = resolve(options.output ?? "artifacts/llm-eval/evidence.json");
const providerPath = fileURLToPath(new URL("./provider.mjs", import.meta.url));
const promptfooPath = join(dirname(fileURLToPath(import.meta.resolve("promptfoo"))), "entrypoint.js");
const startedAt = new Date().toISOString();
const evidence = {
  authoritative: options.provider === "claude-ci",
  cases: {},
  errors: [],
  finishedAt: undefined,
  model: "claude-sonnet-4-6",
  provider: options.provider,
  semanticRetries: 0,
  startedAt,
  status: "failed",
};

await mkdir(dirname(outputPath), { recursive: true });
for (const path of options.casePaths) {
  try {
    const result = options.smoke ? await runSmokeCase(path) : await runSemanticCase(path);
    evidence.cases[result.path] = result.evidence;
  } catch (error) {
    evidence.errors.push(error instanceof Error ? error.message : String(error));
  }
}
evidence.finishedAt = new Date().toISOString();
evidence.status = evidence.errors.length === 0 ? "passed" : "failed";
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

if (evidence.errors.length > 0) {
  process.stderr.write(`Semantic evaluation failed; evidence: ${outputPath}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Semantic evaluation passed for ${options.casePaths.length} case(s); evidence: ${outputPath}\n`);
}

async function runSemanticCase(path) {
  const testCase = await loadSemanticCase(path);
  const directory = await mkdtemp(join(tmpdir(), "emseepea-semantic-"));
  const configPath = join(directory, "promptfoo.json");
  const promptfooOutput = join(directory, "promptfoo-output.json");
  const providerEvidence = join(directory, "provider.jsonl");
  const config = promptfooConfig(testCase);
  await writeFile(configPath, JSON.stringify(config), { encoding: "utf8", mode: 0o600 });
  try {
    const run = await runProcess(process.execPath, [
      promptfooPath,
      "eval",
      "--config", configPath,
      "--repeat", "3",
      "--max-concurrency", "1",
      "--no-cache",
      "--no-share",
      "--no-write",
      "--no-table",
      "--no-progress-bar",
      "--output", promptfooOutput,
    ], {
      cwd: directory,
      env: cleanEnvironment({
        CLAUDE_CODE_OAUTH_TOKEN: options.provider === "claude-ci"
          ? process.env.CLAUDE_CODE_OAUTH_TOKEN
          : undefined,
        EMSEEPEA_EVAL_PROVIDER: options.provider,
        EMSEEPEA_EVAL_PROVIDER_EVIDENCE: providerEvidence,
        EMSEEPEA_MODEL_COMMAND: options.modelCommand,
        PROMPTFOO_CONFIG_DIR: directory,
      }),
      timeoutMs: 38 * 60_000,
    });
    if (run.timedOut) throw new Error(`${testCase.description}: Promptfoo timed out`);
    const records = readJsonLines(await readFile(providerEvidence, "utf8"));
    const entries = promptfooEntries(JSON.parse(await readFile(promptfooOutput, "utf8")));
    if (run.code !== 0) {
      if (process.env.EMSEEPEA_DEBUG === "1") process.stderr.write(run.stderr.slice(-4_000));
      throw new Error(`${testCase.description}: Promptfoo exited ${run.code}`);
    }
    verifyProviderRecords(testCase, records);
    if (entries.length !== 3 || entries.some(({ success }) => success !== true)) {
      throw new Error(`${testCase.description}: ${entries.filter(({ success }) => success).length}/${entries.length} trials passed`);
    }
    return {
      path: testCase.path,
      evidence: {
        agentTrials: records.filter(({ role }) => role === "agent"),
        configSha256: createHash("sha256").update(JSON.stringify(config)).digest("hex"),
        judgeVerdicts: records.filter(({ role }) => role === "judge"),
        promptfooTrials: entries.map(({ description, score, success }) => ({ description, score, success })),
      },
    };
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function promptfooConfig(testCase) {
  const judge = {
    id: `file://${providerPath}`,
    config: { maxRetries: 0, role: "judge" },
  };
  const rubric = [
    "Judge the meaning of this answer against every criterion below.",
    "A pass requires every criterion. Ignore harmless wording differences.",
    "",
    "Criteria:",
    "{{criteria}}",
    "",
    "Answer:",
    "<answer>",
    "{{output}}",
    "</answer>",
    "",
    "Return only JSON with this exact shape:",
    '{"pass": true or false, "score": 1 or 0, "reason": "one concise sentence"}',
  ].join("\n");
  const judgeAssertion = () => ({
    type: "llm-rubric",
    value: testCase.criteria,
    provider: judge,
    rubricPrompt: rubric,
  });
  return {
    description: testCase.description,
    providers: [{
      id: `file://${providerPath}`,
      config: { maxRetries: 0, role: "agent" },
    }],
    prompts: ["{{question}}"],
    defaultTest: {
      options: {
        timeoutMs: 120_000,
      },
      assert: [
        {
          type: "javascript",
          value: [
            "const actual = context.metadata?.pathEvidence ?? [];",
            "const seen = new Set(actual.map(({ method, target }) => `${method}:${target}`));",
            "const missing = JSON.parse(context.vars.requiredPaths).filter((path) => !seen.has(path));",
            "return missing.length === 0",
            "  ? { pass: true, score: 1, reason: 'required MCP path evidence recorded' }",
            "  : { pass: false, score: 0, reason: `missing MCP path evidence: ${missing.join(', ')}` };",
          ].join("\n"),
        },
        {
          type: "javascript",
          value: [
            "const answer = String(output).toLowerCase();",
            "const missing = JSON.parse(context.vars.criticalFacts)",
            "  .filter((fact) => !answer.includes(fact.toLowerCase()));",
            "return missing.length === 0",
            "  ? { pass: true, score: 1, reason: 'critical facts present' }",
            "  : { pass: false, score: 0, reason: `missing critical facts: ${missing.join(', ')}` };",
          ].join("\n"),
        },
        judgeAssertion(),
        judgeAssertion(),
        judgeAssertion(),
      ],
    },
    tests: [{
      description: testCase.description,
      vars: {
        casePath: testCase.path,
        criteria: testCase.criteria,
        criticalFacts: JSON.stringify(testCase.criticalFacts),
        question: testCase.question,
        requiredPaths: JSON.stringify(requiredPaths(testCase)),
      },
    }],
  };
}

async function runSmokeCase(path) {
  const testCase = await loadSemanticCase(path);
  const records = [];
  const previousModelCommand = process.env.EMSEEPEA_MODEL_COMMAND;
  process.env.EMSEEPEA_MODEL_COMMAND = options.modelCommand;
  try {
    for (let trial = 1; trial <= 3; trial += 1) {
      const directory = await mkdtemp(join(tmpdir(), "emseepea-agent-"));
      let running;
      try {
        running = await startSemanticServer(testCase);
        const material = await collectMcpMaterial(running.url, testCase);
        const prompt = `${material.text}\n\nAnswer only from that MCP material.\n\nQuestion:\n${testCase.question}`;
        const result = await runModel(options.provider, prompt, directory);
        const agentRecord = {
          casePath: testCase.path,
          materialSha256: createHash("sha256").update(material.text).digest("hex"),
          models: result.models,
          pathEvidence: material.pathEvidence,
          provider: options.provider,
          role: "agent",
          status: "completed",
          toolCallCount: 0,
          trial,
          turnCount: result.turnCount,
        };
        records.push(agentRecord);
        const answer = result.answer;
        for (let judgment = 1; judgment <= 3; judgment += 1) {
          const judgeDirectory = await mkdtemp(join(tmpdir(), "emseepea-judge-"));
          try {
            const judgeResult = await runModel(options.provider, judgePrompt(testCase, answer), judgeDirectory);
            records.push({
              casePath: testCase.path,
              models: judgeResult.models,
              provider: options.provider,
              role: "judge",
              status: "completed",
              trial: ((trial - 1) * 3) + judgment,
              turnCount: judgeResult.turnCount,
              verdict: parseJudgeVerdict(judgeResult.answer.trim()),
            });
          } finally {
            await rm(judgeDirectory, { force: true, recursive: true });
          }
        }
      } finally {
        if (running) await stopSemanticServer(running.child);
        await rm(directory, { force: true, recursive: true });
      }
    }
  } finally {
    if (previousModelCommand === undefined) delete process.env.EMSEEPEA_MODEL_COMMAND;
    else process.env.EMSEEPEA_MODEL_COMMAND = previousModelCommand;
  }
  verifyProviderRecords(testCase, records);
  return {
    path: testCase.path,
    evidence: {
      agentTrials: records.filter(({ role }) => role === "agent"),
      configSha256: createHash("sha256").update(JSON.stringify(promptfooConfig(testCase))).digest("hex"),
      judgeVerdicts: records.filter(({ role }) => role === "judge"),
      promptfooTrials: [{ description: testCase.description, score: 1, success: true }],
      smoke: true,
    },
  };
}

function judgePrompt(testCase, answer) {
  return [
    "Judge the meaning of this answer against every criterion below.",
    "A pass requires every criterion. Ignore harmless wording differences.",
    "",
    "Criteria:",
    testCase.criteria,
    "",
    "Answer:",
    "<answer>",
    answer,
    "</answer>",
    "",
    "Return only JSON with this exact shape:",
    '{"pass": true or false, "score": 1 or 0, "reason": "one concise sentence"}',
  ].join("\n");
}

function verifyProviderRecords(testCase, records) {
  const agents = records.filter(({ role }) => role === "agent");
  const judges = records.filter(({ role }) => role === "judge");
  if (agents.length !== 3 || judges.length !== 9) {
    throw new Error(`${testCase.description}: expected 3 answers and 9 judgments; got ${agents.length} and ${judges.length}`);
  }
  const required = requiredPaths(testCase);
  if (agents.some(({ status, toolCallCount, materialSha256, pathEvidence, turnCount }) => (
    status !== "completed"
    || toolCallCount !== 0
    || turnCount !== 1
    || !/^[a-f0-9]{64}$/.test(materialSha256 ?? "")
    || !Array.isArray(pathEvidence)
    || required.some((path) => !pathEvidence.some(({ method, target, requestSha256, responseSha256 }) => (
      `${method}:${target}` === path
      && /^[a-f0-9]{64}$/.test(requestSha256 ?? "")
      && /^[a-f0-9]{64}$/.test(responseSha256 ?? "")
    )))
  ))) throw new Error(`${testCase.description}: answer evidence is incomplete`);
  if (judges.some(({ status, verdict, turnCount }) => (
    status !== "completed" || turnCount !== 1 || verdict?.pass !== true
  ))) throw new Error(`${testCase.description}: a judgment failed`);
}

function parseArguments(args) {
  const result = { casePaths: [], modelCommand: "claude", output: undefined, provider: "claude-local", smoke: false };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--provider") result.provider = args[++index];
    else if (value === "--model-command") result.modelCommand = args[++index];
    else if (value === "--output") result.output = args[++index];
    else if (value === "--smoke") result.smoke = true;
    else if (value?.startsWith("--")) throw new Error(`Unknown option: ${value}`);
    else result.casePaths.push(value);
  }
  if (!new Set(["claude-local", "claude-ci"]).has(result.provider)) {
    throw new Error(`Unsupported provider: ${result.provider}`);
  }
  if (result.casePaths.length === 0) throw new Error("Pass at least one eval.yaml path");
  if (result.modelCommand.includes("/") || result.modelCommand.includes("\\")) {
    result.modelCommand = resolve(result.modelCommand);
  }
  return result;
}

function cleanEnvironment(extra) {
  return Object.fromEntries(Object.entries({
    CI: "true",
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "C.UTF-8",
    LOGNAME: process.env.LOGNAME,
    NO_COLOR: "1",
    PATH: process.env.PATH,
    PROMPTFOO_CACHE_ENABLED: "false",
    PROMPTFOO_DISABLE_REMOTE_GENERATION: "true",
    PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION: "true",
    PROMPTFOO_DISABLE_SHARING: "true",
    PROMPTFOO_DISABLE_TELEMETRY: "true",
    PROMPTFOO_DISABLE_TEMPLATE_ENV_VARS: "true",
    PROMPTFOO_DISABLE_UPDATE: "true",
    PROMPTFOO_SELF_HOSTED: "true",
    SHELL: process.env.SHELL,
    TMPDIR: process.env.TMPDIR,
    USER: process.env.USER,
    ...extra,
  }).filter(([, value]) => value !== undefined));
}

function runProcess(command, args, options = {}) {
  const { timeoutMs, ...spawnOptions } = options;
  return new Promise((resolve) => {
    const grouped = process.platform !== "win32";
    const child = spawn(command, args, { detached: grouped, stdio: ["ignore", "pipe", "pipe"], ...spawnOptions });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const stop = () => {
      try {
        if (grouped) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    };
    const interrupted = () => stop();
    process.once("SIGINT", interrupted);
    process.once("SIGTERM", interrupted);
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      resolve({ code: 1, error: error.message, stderr, stdout, timedOut });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      resolve({ code: code ?? 1, stderr, stdout, timedOut });
    });
  });
}

function readJsonLines(source) {
  return source.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function promptfooEntries(value, found = []) {
  if (Array.isArray(value)) {
    if (value.every((entry) => entry && typeof entry === "object" && "success" in entry)) found.push(...value);
    else for (const entry of value) promptfooEntries(entry, found);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) promptfooEntries(entry, found);
  }
  return found;
}
