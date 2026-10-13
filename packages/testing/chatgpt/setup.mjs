#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const help = `Usage: emseepea-chatgpt-setup --enable-native-chatgpt --account-owner <owner>
  [--profile <dedicated-directory>] [--authenticated-selector <CSS selector>]
  [--browser-channel chromium|chrome|msedge]

Opens a headed ChatGPT browser for human login and consent. Authentication stays
in the private local profile; it is never exported to evidence or a repository.
Install the optional playwright@1.62.1 dependency and its Chromium browser first.
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log(help); return; }
  if (args.filter((arg) => arg === "--enable-native-chatgpt").length !== 1) throw new Error("explicit-opt-in-required");
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--enable-native-chatgpt") continue;
    if (!["--account-owner", "--profile", "--authenticated-selector", "--browser-channel"].includes(arg) || values.has(arg) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("invalid-setup-options");
    values.set(arg, args[++index]);
  }
  const owner = values.get("--account-owner");
  if (!owner?.trim() || owner.length > 256) throw new Error("account-owner-required");
  if (!process.stdin.isTTY) throw new Error("interactive-local-terminal-required");
  const selector = values.get("--authenticated-selector") ?? '[data-testid="accounts-profile-button"]';
  if (selector.length > 1024) throw new Error("invalid-setup-options");
  const channel = values.get("--browser-channel") ?? "chromium";
  if (!["chromium", "chrome", "msedge"].includes(channel)) throw new Error("invalid-setup-options");
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { throw new Error("optional-playwright-dependency-required"); }
  const profile = resolve(values.get("--profile") ?? join(homedir(), ".emseepea", "chatgpt-browser"));
  const marker = join(profile, "emseepea-profile.json");
  const ownerSha256 = createHash("sha256").update(owner).digest("hex");
  await mkdir(profile, { recursive: true, mode: 0o700 });
  const existing = await readdir(profile);
  if (existing.length) {
    const record = await readFile(marker, "utf8").then(JSON.parse).catch(() => undefined);
    if (record?.schemaVersion !== 1 || record?.ownerSha256 !== ownerSha256) throw new Error("dedicated-owned-profile-required");
  }
  {
    await writeFile(marker, `${JSON.stringify({ schemaVersion: 1, ownerSha256, humanConfirmed: false, channel })}\n`, { mode: 0o600 });
  }
  await chmod(profile, 0o700);
  let context;
  try { context = await chromium.launchPersistentContext(profile, { headless: false, ...(channel === "chromium" ? {} : { channel }) }); }
  catch { throw new Error("headed-browser-unavailable"); }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
    console.log("Sign in to the authorized test account in the browser. Complete MFA and any consent yourself.");
    const confirmation = await terminal.question("After checking the account, type READY to verify the signed-in control: ");
    if (confirmation !== "READY") throw new Error("human-confirmation-required");
    if (new URL(page.url()).origin !== "https://chatgpt.com") throw new Error("native-chatgpt-page-required");
    try { await page.locator(selector).waitFor({ state: "visible", timeout: 10_000 }); }
    catch { throw new Error("signed-in-control-unobserved"); }
    await writeFile(marker, `${JSON.stringify({ schemaVersion: 1, ownerSha256, humanConfirmed: true, channel })}\n`, { mode: 0o600 });
    await chmod(marker, 0o600);
    console.log("Signed-in control observed. The dedicated local profile is ready for explicitly enabled journeys.");
  } finally {
    terminal.close();
    await context.close();
  }
}

main().catch((error) => {
  // Never print browser errors, headers, cookies, account metadata, or credentials.
  const categories = new Set(["explicit-opt-in-required", "invalid-setup-options", "account-owner-required",
    "interactive-local-terminal-required", "optional-playwright-dependency-required", "dedicated-owned-profile-required",
    "headed-browser-unavailable", "human-confirmation-required", "native-chatgpt-page-required", "signed-in-control-unobserved"]);
  console.error(`ChatGPT setup blocked: ${categories.has(error.message) ? error.message : "setup-unavailable"}`);
  console.error(help);
  process.exitCode = 2;
});
