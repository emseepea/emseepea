#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const configPath = join(here, "promptfooconfig.yaml");
const artifactDirectory = join(repoRoot, "artifacts/llm-eval");
const promptfooOutput = join(artifactDirectory, "promptfoo.json");
const providerEvidence = join(artifactDirectory, "provider.jsonl");
const evidencePath = join(artifactDirectory, "evidence.json");
const examples = [
  "basic-no-ui",
  "backend-no-ui",
  "protected-no-ui",
  "resources-prompts",
  "streaming-progress",
];
const expectedPaths = {
  "basic-no-ui": [["tools/call", "get-bean-details"]],
  "backend-no-ui": [["tools/call", "create-bean-report"]],
  "protected-no-ui": [["tools/call", "get-private-inventory-report"]],
  "resources-prompts": [
    ["resources/read", "guide://coffee/getting-started"],
    ["prompts/get", "brew-guide"],
  ],
  "streaming-progress": [["tools/call", "roast-sample-batch"]],
};
const providerFlag = process.argv.indexOf("--provider");
const provider = providerFlag >= 0 ? process.argv[providerFlag + 1] : "claude";
const authoritative = provider === "copilot";
const startedAt = new Date().toISOString();
const suiteTimeoutMs = 38 * 60_000;

if (!new Set(["claude", "copilot"]).has(provider)) {
  throw new Error(`unsupported semantic provider: ${provider}`);
}

function run(command, args, options = {}) {
  const { timeoutMs, ...spawnOptions } = options;
  return new Promise((resolveRun) => {
    const grouped = process.platform !== "win32";
    const child = spawn(command, args, {
      detached: grouped,
      stdio: ["ignore", "pipe", "pipe"],
      ...spawnOptions,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = timeoutMs ? setTimeout(() => {
      timedOut = true;
      try {
        if (grouped) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    }, timeoutMs) : undefined;
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      if (timer) clearTimeout(timer);
      resolveRun({ code: 1, error: error.message, stderr, stdout, timedOut });
    });
    child.once("close", (code) => {
      if (timer) clearTimeout(timer);
      resolveRun({ code: code ?? 1, stderr, stdout, timedOut });
    });
  });
}

function cleanEnvironment(extra = {}) {
  return Object.fromEntries(Object.entries({
    CI: "true",
    EMSEEPEA_COPILOT_TOKEN_FILE: process.env.EMSEEPEA_COPILOT_TOKEN_FILE,
    EMSEEPEA_EVAL_PROVIDER: provider,
    EMSEEPEA_EVAL_PROVIDER_EVIDENCE: providerEvidence,
    GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
    GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_SHA: process.env.GITHUB_SHA,
    HOME: process.env.HOME,
    IS_TESTING: "true",
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

async function packageVersion(name) {
  const manifest = JSON.parse(await readFile(join(repoRoot, "node_modules", ...name.split("/"), "package.json"), "utf8"));
  return manifest.version;
}

async function git(...args) {
  const result = await run("git", args, { cwd: repoRoot, env: cleanEnvironment() });
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function readProviderRecords(source) {
  return source.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function promptfooEntries(value, found = []) {
  if (Array.isArray(value)) {
    if (value.every((entry) => entry && typeof entry === "object" && "success" in entry)) {
      found.push(...value);
    } else {
      for (const entry of value) promptfooEntries(entry, found);
    }
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) promptfooEntries(entry, found);
  }
  return found;
}

function verifyProviderRecords(records) {
  for (const example of examples) {
    const agents = records.filter((record) => record.example === example && record.role === "agent");
    const judges = records.filter((record) => record.example === example && record.role === "judge");
    if (agents.length !== 3 || judges.length !== 3) {
      throw new Error(`${example} produced ${agents.length} agent and ${judges.length} judge outputs`);
    }
    if (agents.some(({ status, toolCallCount, materialSha256, pathEvidence }) => {
      const expected = expectedPaths[example];
      return status !== "completed"
        || toolCallCount !== 0
        || !/^[a-f0-9]{64}$/.test(materialSha256 ?? "")
        || !Array.isArray(pathEvidence)
        || pathEvidence.length !== expected.length
        || expected.some(([method, target]) => !pathEvidence.some((entry) => (
          entry.server === "emseepea_eval"
          && entry.method === method
          && entry.target === target
          && /^[a-f0-9]{64}$/.test(entry.requestSha256 ?? "")
          && /^[a-f0-9]{64}$/.test(entry.responseSha256 ?? "")
        )));
    })) {
      throw new Error(`${example} has an incomplete or tool-enabled agent trial`);
    }
    if (judges.some(({ status, verdict }) => status !== "completed" || verdict?.pass !== true)) {
      throw new Error(`${example} has a missing or failed judge verdict`);
    }
  }
}

await rm(artifactDirectory, { force: true, recursive: true });
await mkdir(artifactDirectory, { recursive: true });
const promptfooDirectory = await mkdtemp(join(tmpdir(), "emseepea-promptfoo-"));
let promptfoo;
let failure;
let records = [];
let resultEntries = [];
let commit;
let sourceSha256;
let workingTreeClean;
try {
  commit = await git("rev-parse", "HEAD");
  const trackedDiff = await git("diff", "HEAD", "--binary", "--no-ext-diff");
  const untracked = (await git("ls-files", "--others", "--exclude-standard", "-z"))
    .split("\0")
    .filter(Boolean)
    .sort();
  workingTreeClean = trackedDiff === "" && untracked.length === 0;
  const sourceHash = createHash("sha256").update(trackedDiff);
  for (const path of untracked) sourceHash.update(path).update(await readFile(join(repoRoot, path)));
  sourceSha256 = sourceHash.digest("hex");
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== commit) {
    throw new Error(`GITHUB_SHA ${process.env.GITHUB_SHA} does not match checked-out ${commit}`);
  }
  if (authoritative && !workingTreeClean) {
    throw new Error("authoritative evaluation requires a clean exact-commit checkout");
  }
  if (authoritative && !process.env.EMSEEPEA_COPILOT_TOKEN_FILE) {
    throw new Error("authoritative evaluation requires EMSEEPEA_COPILOT_TOKEN_FILE");
  }
  promptfoo = await run(
    join(repoRoot, "node_modules/.bin/promptfoo"),
    [
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
    ],
    {
      cwd: promptfooDirectory,
      env: cleanEnvironment({ PROMPTFOO_CONFIG_DIR: promptfooDirectory }),
      timeoutMs: suiteTimeoutMs,
    },
  );
  if (promptfoo.timedOut) throw new Error(`Promptfoo suite exceeded ${suiteTimeoutMs} ms`);
  records = readProviderRecords(await readFile(providerEvidence, "utf8"));
  verifyProviderRecords(records);
  const promptfooDocument = JSON.parse(await readFile(promptfooOutput, "utf8"));
  resultEntries = promptfooEntries(promptfooDocument);
  if (promptfoo.code !== 0) throw new Error(`Promptfoo exited ${promptfoo.code}`);
  if (resultEntries.length !== examples.length * 3 || resultEntries.some(({ success }) => success !== true)) {
    throw new Error(`Promptfoo recorded ${resultEntries.filter(({ success }) => success).length}/${resultEntries.length} passing trials`);
  }
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
}

const config = await readFile(configPath);
const packageVersions = {
  copilot: await packageVersion("@github/copilot"),
  promptfoo: await packageVersion("promptfoo"),
};
const runUrl = process.env.GITHUB_RUN_ID && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;
const evidence = {
  authoritative,
  commit,
  configSha256: createHash("sha256").update(config).digest("hex"),
  errors: failure ? [failure] : [],
  examples: Object.fromEntries(examples.map((example) => [example, {
    agentTrials: records.filter((record) => record.example === example && record.role === "agent"),
    judgeVerdicts: records.filter((record) => record.example === example && record.role === "judge"),
    promptfooTrials: resultEntries
      .filter((entry) => entry.vars?.example === example)
      .map(({ description, score, success }) => ({ description, score, success })),
  }])),
  finishedAt: new Date().toISOString(),
  model: authoritative ? "claude-sonnet-4.6" : "local Claude advisory",
  packageVersions,
  provider,
  providerTimeoutMs: 120_000,
  runUrl,
  semanticRetries: 0,
  sourceSha256,
  startedAt,
  status: failure ? "failed" : "passed",
  transportRetries: null,
  transportRetryPolicy: "Promptfoo retries disabled; provider-internal retries unobservable and bounded by timeout",
  workingTreeClean,
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
await rm(promptfooDirectory, { force: true, recursive: true });

if (failure) {
  process.stderr.write(`Semantic evaluation failed: ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Semantic evaluation passed for ${examples.length} examples; evidence: ${evidencePath}\n`);
}
