#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { attachOwnedBrowser, validateBrowserAttachment } from "./session.mjs";

const help = `Usage: emseepea-chatgpt --enable-native-chatgpt --scenario <owned-module.mjs>
  [--profile <dedicated-directory>] [--output <private-evidence.json>]
  Or attach: --connect-cdp <loopback-browser-WebSocket> --browser-owner <owner>

The module exports authorization and createJourney({ page, runId }). It owns
its assertions, server observations, and cleanup. Complete human setup first,
or explicitly confirm ownership of an already-authorized local CDP browser.
This command never logs in, grants consent, or exports authentication state.
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log(help); return; }
  if (args.filter((arg) => arg === "--enable-native-chatgpt").length !== 1) throw new Error("explicit-opt-in-required");
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--enable-native-chatgpt") continue;
    if (!["--scenario", "--profile", "--output", "--connect-cdp", "--browser-owner"].includes(arg) || values.has(arg) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("invalid-run-options");
    values.set(arg, args[++index]);
  }
  if (!values.get("--scenario")) throw new Error("owned-scenario-required");
  const scenario = await import(pathToFileURL(resolve(values.get("--scenario"))).href);
  if (typeof scenario.createJourney !== "function" || scenario.authorization?.approved !== true || typeof scenario.authorization.accountOwner !== "string") throw new Error("owned-scenario-required");
  const attached = values.has("--connect-cdp");
  if ((attached && values.has("--profile")) || (!attached && values.has("--browser-owner"))) throw new Error("invalid-run-options");
  if (attached) validateBrowserAttachment(values.get("--connect-cdp"), values.get("--browser-owner"), scenario.authorization.accountOwner);
  let profile;
  let record;
  if (!attached) {
    profile = resolve(values.get("--profile") ?? join(homedir(), ".emseepea", "chatgpt-browser"));
    record = await readFile(join(profile, "emseepea-profile.json"), "utf8").then(JSON.parse).catch(() => undefined);
    const ownerSha256 = createHash("sha256").update(scenario.authorization.accountOwner).digest("hex");
    if (record?.schemaVersion !== 1 || record?.humanConfirmed !== true || record?.ownerSha256 !== ownerSha256 || !["chromium", "chrome", "msedge"].includes(record?.channel)) throw new Error("human-setup-required");
  }
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { throw new Error("optional-playwright-dependency-required"); }
  const { runNativeChatGptJourney } = await import("../dist/chatgpt.js");
  let session;
  if (attached) session = await attachOwnedBrowser({ chromium, endpoint: values.get("--connect-cdp"), browserOwner: values.get("--browser-owner"), accountOwner: scenario.authorization.accountOwner });
  else {
    let context;
    try { context = await chromium.launchPersistentContext(profile, { headless: false, chromiumSandbox: true, ...(record.channel === "chromium" ? {} : { channel: record.channel }) }); }
    catch { throw new Error("headed-browser-unavailable"); }
    session = { page: context.pages()[0] ?? await context.newPage(), close: () => context.close() };
  }
  try {
    const page = session.page;
    if (!attached) await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
    const runId = randomUUID();
    const declared = await scenario.createJourney({ page, runId });
    const evidence = await runNativeChatGptJourney({ ...declared, enabled: true, page, runId, authorization: scenario.authorization },
      resolve(values.get("--output") ?? "artifacts/native-chatgpt/evidence.json"));
    console.log(`Native ChatGPT journey ${evidence.status}. Evidence written privately.`);
    if (evidence.status !== "passed") process.exitCode = evidence.status === "failed" ? 1 : 2;
  } finally { await session.close(); }
}

main().catch((error) => {
  const categories = new Set(["explicit-opt-in-required", "invalid-run-options", "owned-scenario-required", "human-setup-required", "optional-playwright-dependency-required", "headed-browser-unavailable", "browser-owner-confirmation-required", "loopback-browser-endpoint-required", "owned-browser-attachment-unavailable"]);
  console.error(`Native ChatGPT journey blocked: ${categories.has(error.message) ? error.message : "journey-unavailable"}`);
  process.exitCode = 2;
});
