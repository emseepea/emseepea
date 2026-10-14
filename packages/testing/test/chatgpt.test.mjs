import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { runNativeChatGptJourney } from "../dist/chatgpt.js";

// These are adapter contract tests using a scripted page, not live ChatGPT evidence.
const hash = (text) => createHash("sha256").update(text).digest("hex");
const endpoint = new URL("https://fixture.example/mcp");
const authorization = {
  approved: true, accountOwner: "private-owner@example.test", endpointOwner: "private-endpoint-owner",
  fixtureOwner: "private-fixture-owner", cleanupOwner: "private-cleanup-owner", fixturePolicy: "synthetic", endpoint,
};

function fixture(options = {}) {
  let url = options.url ?? "https://chatgpt.com/";
  let thread = 0;
  let prompt = "";
  let messages = [];
  let userMessages = 0;
  let cleanupCount = 0;
  const composer = { async fill(text) { prompt = text; }, async innerText() { return ""; }, async waitFor() {} };
  const submit = { async click() { userMessages += 1; thread += 1; url = `https://chatgpt.com/c/${options.sameThread ? "same" : thread}`; messages.push("Saved diagram ready at 08:10 private-response-sentinel"); } };
  const controls = {
    composer, submit,
    assistantMessages: { async count() { return messages.length; }, nth(index) { return { async waitFor() {}, async innerText() { return messages[index]; } }; } },
    conversationMessages: { async count() { return messages.length + userMessages; } },
    generating: { async isVisible() { return false; } },
    fileInput: { async setInputFiles(file) { assert.equal(file.buffer.toString(), "synthetic PDF bytes"); } },
  };
  const page = { url: () => url, async goto(next) { url = next; if (!options.retainMessages) messages = []; if (!options.retainMessages && !options.retainUserOnly) userMessages = 0; } };
  for (const control of Object.values(controls)) control.page = () => page;
  const expected = [{ method: "tools/call", target: "read-diagram", outcome: "success", responseSha256: hash("fixture-result") }];
  const observe = (id = "observe", transform = (call) => call) => ({
    id, operation: "server-observation", expectedCalls: expected,
    collect: async ({ runId, afterSequence, since }) => [transform({
      sequence: afterSequence + 1, runId, endpointSha256: hash(endpoint.href), nativeClient: "verified-chatgpt",
      observedAt: since, method: "tools/call", target: "read-diagram", outcome: "success",
      requestSha256: hash(prompt), responseSha256: hash("fixture-result"), privateMetadata: "must-not-retain",
    })],
  });
  const send = (id = "send") => ({ id, operation: "send", prompt: "Find the saved diagram private-prompt-sentinel", expectResponse: (text) => text.includes("08:10") });
  const journey = {
    enabled: true, runId: "synthetic-run", page, controls, authorization, timeoutMs: 3000,
    checkpoints: [send(), observe()],
    cleanup: async () => { cleanupCount += 1; return { fixturesRemoved: true, conversationsRemoved: true }; },
  };
  return { journey, observe, send, cleanupCount: () => cleanupCount };
}

async function output(t) {
  const directory = await mkdtemp(join(tmpdir(), "chatgpt-adapter-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, "evidence.json");
}

test("native browser execution requires explicit opt-in and ownership before touching a page", async (t) => {
  const path = await output(t);
  const { journey } = fixture();
  const page = { url() { assert.fail("disabled integration touched the page"); } };
  await assert.rejects(runNativeChatGptJourney({ ...journey, enabled: false, page }, path), /explicitly enabled/);
  await assert.rejects(runNativeChatGptJourney({ ...journey, authorization: { ...authorization, approved: false }, page }, path), /ownership/);
  await assert.rejects(readFile(path), { code: "ENOENT" });
});

test("initial and fresh journeys retain scoped hash evidence and clean up", async (t) => {
  const path = await output(t);
  const f = fixture();
  f.journey.checkpoints.push({ id: "fresh", operation: "fresh-conversation" }, f.send("fresh-read"), f.observe("fresh-observe"));
  const result = await runNativeChatGptJourney(f.journey, path);
  assert.equal(result.status, "passed");
  assert.equal(result.evidenceKind, "native-chatgpt-browser");
  assert.equal(f.cleanupCount(), 1);
  const text = await readFile(path, "utf8");
  for (const privateText of ["private-owner", "private-endpoint", "private-fixture", "private-cleanup", "private-response-sentinel", "private-prompt-sentinel", "must-not-retain", endpoint.href]) assert.equal(text.includes(privateText), false);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.notEqual(result.checkpoints[0].observation.conversationSha256, result.checkpoints[3].observation.conversationSha256);
});

test("fresh retrieval rejects inherited messages even when the next conversation ID would differ", async (t) => {
  const path = await output(t);
  for (const options of [{ retainMessages: true }, { retainUserOnly: true }]) {
    const f = fixture(options);
    f.journey.checkpoints.push({ id: "fresh", operation: "fresh-conversation" }, f.send("fresh-read"), f.observe("fresh-observe"));
    const result = await runNativeChatGptJourney(f.journey, path);
    assert.equal(result.status, "incomplete");
    assert.equal(result.checkpoints.find((checkpoint) => checkpoint.id === "fresh").category, "fresh-conversation-unconfirmed");
    assert.equal(result.checkpoints.some((checkpoint) => checkpoint.id === "fresh-read"), false);
    assert.equal(f.cleanupCount(), 1);
  }
});

test("a simulator, login redirect, and missing human approval cannot pass", async (t) => {
  const path = await output(t);
  const f = fixture({ url: "http://127.0.0.1:3000/" });
  const blocked = await runNativeChatGptJourney(f.journey, path);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.checkpoints[0].category, "native-host-required");
  assert.equal(f.cleanupCount(), 1);
  const login = fixture({ url: "https://auth.openai.com/" });
  login.journey.checkpoints = [{ id: "login", operation: "human", ready: async () => false }];
  const waiting = await runNativeChatGptJourney(login.journey, path);
  assert.equal(waiting.status, "blocked");
  assert.equal(waiting.checkpoints[0].category, "human-required");
});

test("native results fail closed on foreign, stale, unverified, and mismatched server observations", async (t) => {
  const directory = dirnameFor(await output(t));
  for (const [name, change, category] of [
    ["foreign", (call) => ({ ...call, endpointSha256: hash("other-server") }), "server-observation-scope"],
    ["unverified", (call) => ({ ...call, nativeClient: "user-agent-only" }), "server-observation-scope"],
    ["stale", (call) => ({ ...call, observedAt: "2000-01-01T00:00:00Z" }), "server-observation-scope"],
    ["wrong-run", (call) => ({ ...call, runId: "other-run" }), "server-observation-scope"],
    ["wrong-target", (call) => ({ ...call, target: "foreign-tool" }), "server-assertion"],
    ["wrong-result", (call) => ({ ...call, responseSha256: hash("fabricated-result") }), "server-assertion"],
  ]) {
    const f = fixture();
    f.journey.checkpoints = [f.send(), f.observe("observe", change)];
    const result = await runNativeChatGptJourney(f.journey, join(directory, `${name}.json`));
    assert.equal(result.status, "failed", name);
    assert.equal(result.checkpoints[1].category, category, name);
    assert.equal(f.cleanupCount(), 1);
  }
});

test("unobserved turns, reused conversation IDs, and unconfirmed cleanup stay incomplete", async (t) => {
  const path = await output(t);
  const missing = fixture();
  missing.journey.checkpoints = [missing.send()];
  assert.equal((await runNativeChatGptJourney(missing.journey, path)).status, "incomplete");
  const reused = fixture({ sameThread: true });
  reused.journey.checkpoints.push({ id: "fresh", operation: "fresh-conversation" }, reused.send("again"), reused.observe("again-observe"));
  const result = await runNativeChatGptJourney(reused.journey, path);
  assert.equal(result.status, "incomplete");
  assert.equal(result.checkpoints[3].category, "fresh-conversation-unconfirmed");
  const cleanup = fixture();
  cleanup.journey.cleanup = async () => undefined;
  const notClean = await runNativeChatGptJourney(cleanup.journey, path);
  assert.equal(notClean.status, "incomplete");
  assert.equal(notClean.checkpoints.at(-1).category, "cleanup-unconfirmed");
  const unverified = fixture();
  unverified.journey.checkpoints = [unverified.send(), unverified.observe("observe", (call) => ({ ...call, nativeClient: "unverified" }))];
  const notNative = await runNativeChatGptJourney(unverified.journey, path);
  assert.equal(notNative.status, "incomplete");
  assert.equal(notNative.checkpoints[1].category, "native-client-unverified");
});

test("collectors cannot replace declared expectations with actual calls", async (t) => {
  const path = await output(t);
  const f = fixture();
  const observation = f.observe();
  const collect = observation.collect;
  observation.collect = async (context) => {
    observation.expectedCalls[0].target = "unexpected-tool";
    const calls = await collect(context);
    return calls.map((call) => ({ ...call, target: "unexpected-tool" }));
  };
  f.journey.checkpoints = [f.send(), observation];
  const result = await runNativeChatGptJourney(f.journey, path);
  assert.equal(result.status, "failed");
  assert.equal(result.checkpoints[1].category, "server-assertion");
});

test("tool and resource reads remain distinct bounded native evidence", async (t) => {
  const path = await output(t);
  const f = fixture();
  const expectedCalls = [
    { method: "tools/call", target: "get-synthetic-material", outcome: "success" },
    { method: "resources/read", target: "acceptance://issue-145/original-image", outcome: "success" },
  ];
  const collect = async ({ runId, afterSequence, since }) => expectedCalls.map((call, index) => ({
    sequence: afterSequence + index + 1,
    runId,
    endpointSha256: hash(endpoint.href),
    nativeClient: "verified-chatgpt",
    observedAt: since,
    ...call,
    requestSha256: hash(`${call.method}:${call.target}:request`),
    responseSha256: hash(`${call.method}:${call.target}:response`),
  }));
  f.journey.checkpoints = [f.send(), { id: "native-resource", operation: "server-observation", expectedCalls, collect }];

  const result = await runNativeChatGptJourney(f.journey, path);

  assert.equal(result.status, "passed");
  assert.deepEqual(result.checkpoints[1].observation.calls.map((call) => call.method), ["tools/call", "resources/read"]);
  assert.equal(result.checkpoints[1].observation.calls[1].targetSha256, hash("acceptance://issue-145/original-image"));
});

test("a missing native resource read stays incomplete", async (t) => {
  const path = await output(t);
  const f = fixture();
  const expectedCalls = [
    { method: "tools/call", target: "get-synthetic-material", outcome: "success" },
    { method: "resources/read", target: "acceptance://issue-145/original-image", outcome: "success" },
  ];
  f.journey.checkpoints = [f.send(), {
    id: "native-resource",
    operation: "server-observation",
    expectedCalls,
    collect: async ({ runId, afterSequence, since }) => [{
      sequence: afterSequence + 1,
      runId,
      endpointSha256: hash(endpoint.href),
      nativeClient: "verified-chatgpt",
      observedAt: since,
      method: "tools/call",
      target: "get-synthetic-material",
      requestSha256: hash("tool-request"),
      responseSha256: hash("tool-response"),
      outcome: "success",
    }],
  }];

  const result = await runNativeChatGptJourney(f.journey, path);

  assert.equal(result.status, "incomplete");
  assert.equal(result.checkpoints[1].category, "server-observation-missing");
});

test("fixture uploads, visual assertions, and independent saved state are bounded observations", async (t) => {
  const path = await output(t);
  const file = join(dirnameFor(path), "fixture.pdf");
  await writeFile(file, "synthetic PDF bytes");
  const visible = { async waitFor() {}, async boundingBox() { return { width: 100, height: 100 }; }, async screenshot() { return Buffer.from("synthetic image pixels"); } };
  const f = fixture();
  visible.page = () => f.journey.page;
  f.journey.checkpoints.unshift({ id: "upload", operation: "attach", file, mimeType: "application/pdf", ready: visible });
  f.journey.checkpoints.push({ id: "card", operation: "visible", target: visible }, { id: "diagram", operation: "image", target: visible, assertImage: async (png) => png.toString() === "synthetic image pixels" }, { id: "saved-state", operation: "application-state", expectedSha256: hash("saved-state"), readState: async () => hash("saved-state") });
  assert.equal((await runNativeChatGptJourney(f.journey, path)).status, "passed");
  assert.equal((await stat(join(dirnameFor(path), "diagram.png"))).mode & 0o777, 0o600);
  const badState = fixture();
  badState.journey.checkpoints.push({ id: "state", operation: "application-state", expectedSha256: hash("saved"), readState: async () => hash("missing") });
  assert.equal((await runNativeChatGptJourney(badState.journey, path)).status, "failed");
});

test("private browser errors are not retained and hung observers receive cancellation", async (t) => {
  const path = await output(t);
  const f = fixture();
  f.journey.checkpoints = [{ id: "human", operation: "human", ready: async () => { throw new Error("private-cookie=secret"); } }];
  assert.equal((await runNativeChatGptJourney(f.journey, path)).status, "incomplete");
  assert.equal((await readFile(path, "utf8")).includes("private-cookie"), false);
  let aborted = false;
  f.journey.timeoutMs = 100;
  f.journey.checkpoints = [{ id: "human", operation: "human", ready: async (signal) => {
    signal.addEventListener("abort", () => { aborted = true; });
    await new Promise(() => {});
  } }];
  const result = await runNativeChatGptJourney(f.journey, path);
  assert.equal(result.status, "incomplete");
  assert.equal(aborted, true);
});

test("ordinary imports and disabled setup do not load Playwright or start a browser", () => {
  const source = new URL("../dist/index.js", import.meta.url).href;
  const optional = new URL("../dist/chatgpt.js", import.meta.url).href;
  const imported = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { registerHooks } from "node:module";
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "playwright" || specifier.startsWith("playwright/")) throw new Error("Playwright was loaded implicitly");
      return next(specifier, context);
    } });
    await import(${JSON.stringify(source)});
    await import(${JSON.stringify(optional)});
  `], { encoding: "utf8" });
  assert.equal(imported.status, 0, imported.stderr);
  const setup = spawnSync(process.execPath, [new URL("../chatgpt/setup.mjs", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(setup.status, 2);
  assert.match(setup.stderr, /explicit-opt-in-required/);
  const noninteractive = spawnSync(process.execPath, [new URL("../chatgpt/setup.mjs", import.meta.url).pathname, "--enable-native-chatgpt", "--account-owner", "fixture-owner"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  assert.equal(noninteractive.status, 2);
  assert.match(noninteractive.stderr, /interactive-local-terminal-required/);
});

function dirnameFor(path) { return dirname(path); }
