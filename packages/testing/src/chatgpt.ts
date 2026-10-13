import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Locator, Page } from "playwright";

export type NativeChatGptStatus = "passed" | "failed" | "blocked" | "incomplete";
export type NativeChatGptMethod = "initialize" | "tools/list" | "tools/call" | "resources/list" | "resources/templates/list" | "resources/read" | "prompts/list" | "prompts/get" | "notifications/cancelled";

export interface NativeChatGptAuthorization {
  readonly approved: true;
  readonly accountOwner: string;
  readonly endpointOwner: string;
  readonly fixtureOwner: string;
  readonly cleanupOwner: string;
  readonly fixturePolicy: "synthetic";
  readonly endpoint: URL;
}

export interface NativeChatGptControls {
  readonly composer: Locator;
  readonly submit: Locator;
  readonly assistantMessages: Locator;
  readonly conversationMessages: Locator;
  readonly generating: Locator;
  readonly fileInput: Locator;
}

export interface NativeChatGptServerCall {
  readonly sequence: number;
  readonly runId: string;
  readonly endpointSha256: string;
  /** Established by the server's authenticated client boundary, never user-agent text. */
  readonly nativeClient: "verified-chatgpt" | "unverified";
  readonly observedAt: string;
  readonly method: NativeChatGptMethod;
  readonly target: string;
  readonly requestSha256: string;
  readonly responseSha256: string;
  readonly outcome: "success" | "denied" | "cancelled";
}

export interface NativeChatGptObservationContext {
  readonly runId: string;
  readonly afterSequence: number;
  readonly since: string;
  readonly signal: AbortSignal;
}

interface CheckpointBase { readonly id: string }
export type NativeChatGptCheckpoint =
  | (CheckpointBase & { readonly operation: "human"; readonly ready: (signal: AbortSignal) => Promise<boolean> })
  | (CheckpointBase & { readonly operation: "fresh-conversation" })
  | (CheckpointBase & { readonly operation: "click"; readonly target: Locator })
  | (CheckpointBase & { readonly operation: "attach"; readonly file: string; readonly mimeType: string; readonly ready: Locator })
  | (CheckpointBase & { readonly operation: "send"; readonly prompt: string; readonly expectResponse: (text: string) => boolean | Promise<boolean> })
  | (CheckpointBase & { readonly operation: "visible"; readonly target: Locator })
  | (CheckpointBase & { readonly operation: "image"; readonly target: Locator; readonly assertImage: (png: Buffer) => boolean | Promise<boolean> })
  | (CheckpointBase & { readonly operation: "application-state"; readonly expectedSha256: string; readonly readState: (signal: AbortSignal) => Promise<string> })
  | (CheckpointBase & {
      readonly operation: "server-observation";
      readonly expectedCalls: readonly {
        readonly method: NativeChatGptMethod;
        readonly target: string;
        readonly outcome: NativeChatGptServerCall["outcome"];
        readonly responseSha256?: string;
      }[];
      readonly collect: (context: NativeChatGptObservationContext) => Promise<readonly NativeChatGptServerCall[]>;
    });

export interface NativeChatGptJourney {
  /** Importing the opt-in entry point alone does not authorize execution. */
  readonly enabled: true;
  readonly runId: string;
  /** The adopter supplies an already authenticated, dedicated browser page. */
  readonly page: Page;
  readonly authorization: NativeChatGptAuthorization;
  readonly controls?: NativeChatGptControls;
  readonly checkpoints: readonly NativeChatGptCheckpoint[];
  readonly timeoutMs?: number;
  /** Bounded allowance for independently clocked server observations. Defaults to 1000 ms. */
  readonly clockSkewMs?: number;
  /** Must remove fixture data and test conversations; profile ownership stays with the adopter. */
  readonly cleanup: (signal: AbortSignal) => Promise<{ readonly fixturesRemoved: true; readonly conversationsRemoved: true }>;
}

export interface NativeChatGptJourneyModule {
  readonly authorization: NativeChatGptAuthorization;
  readonly createJourney: (context: { readonly page: Page; readonly runId: string }) =>
    Promise<Omit<NativeChatGptJourney, "enabled" | "page" | "runId" | "authorization">> |
    Omit<NativeChatGptJourney, "enabled" | "page" | "runId" | "authorization">;
}

export interface NativeChatGptCheckpointEvidence {
  readonly id: string;
  readonly operation: NativeChatGptCheckpoint["operation"] | "cleanup";
  readonly status: NativeChatGptStatus;
  readonly category: string;
  readonly observation?: Readonly<Record<string, unknown>>;
}

export interface NativeChatGptEvidence {
  readonly schemaVersion: 1;
  readonly evidenceKind: "native-chatgpt-browser";
  readonly status: NativeChatGptStatus;
  readonly runId: string;
  readonly endpointSha256: string;
  readonly ownershipSha256: string;
  readonly clockSkewMs: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly checkpoints: readonly NativeChatGptCheckpointEvidence[];
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const METHODS = new Set<NativeChatGptMethod>(["initialize", "tools/list", "tools/call", "resources/list", "resources/templates/list", "resources/read", "prompts/list", "prompts/get", "notifications/cancelled"]);
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_TEXT = 64 * 1024;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Use native DOM controls; callers can replace locators when ChatGPT's UI changes. */
export function nativeChatGptControls(page: Page): NativeChatGptControls {
  return Object.freeze({
    composer: page.locator("#prompt-textarea"),
    submit: page.getByTestId("send-button"),
    assistantMessages: page.locator('[data-message-author-role="assistant"]'),
    conversationMessages: page.locator('[data-message-author-role="user"], [data-message-author-role="assistant"]'),
    generating: page.getByTestId("stop-button"),
    fileInput: page.locator('input[type="file"][multiple]'),
  });
}

/** Preserve type checking for an explicitly enabled, adopter-owned native journey. */
export function defineNativeChatGptJourney(journey: NativeChatGptJourney): NativeChatGptJourney {
  return journey;
}

/** No browser is launched, account connected, or authentication state exported by this runner. */
export async function runNativeChatGptJourney(journey: NativeChatGptJourney, output: string): Promise<NativeChatGptEvidence> {
  validate(journey, output);
  const controls = journey.controls ?? nativeChatGptControls(journey.page);
  for (const control of Object.values(controls)) requireOwnedLocator(control, journey.page);
  const timeout = journey.timeoutMs ?? 30_000;
  const endpointSha256 = digest(journey.authorization.endpoint.href);
  const ownershipSha256 = digest(JSON.stringify([journey.authorization.accountOwner, journey.authorization.endpointOwner, journey.authorization.fixtureOwner, journey.authorization.cleanupOwner]));
  // Snapshot declared expectations before a collector can observe actual calls.
  const steps = journey.checkpoints.map((checkpoint) => checkpoint.operation === "server-observation"
    ? { ...checkpoint, expectedCalls: checkpoint.expectedCalls.map((call) => ({ method: call.method, target: call.target, outcome: call.outcome, ...(call.responseSha256 ? { responseSha256: call.responseSha256 } : {}) })) }
    : { ...checkpoint });
  const startedAt = new Date().toISOString();
  const clockSkewMs = journey.clockSkewMs ?? 1_000;
  const checkpoints: NativeChatGptCheckpointEvidence[] = [];
  let sequence = 0;
  let pendingObservation = false;
  let priorConversation: string | undefined;
  let freshRequired = false;
  let observedCalls = 0;
  let sentTurns = 0;
  let since = startedAt;
  try {
    for (const checkpoint of steps) {
      let observation: Record<string, unknown> | undefined;
      try {
        if (checkpoint.operation !== "human") assertNativeHost(journey.page);
        switch (checkpoint.operation) {
          case "human":
            if (await bounded(checkpoint.ready, timeout) !== true) throw new Outcome("blocked", "human-required");
            assertNativeHost(journey.page);
            break;
          case "fresh-conversation":
            if (pendingObservation) throw new Outcome("incomplete", "unobserved-turn");
            priorConversation = conversationId(journey.page.url()) ?? priorConversation;
            await journey.page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout });
            await controls.composer.waitFor({ state: "visible", timeout });
            if ((await controls.composer.innerText()).trim()) throw new Outcome("incomplete", "composer-not-empty");
            if (await controls.conversationMessages.count() !== 0) throw new Outcome("incomplete", "fresh-conversation-unconfirmed");
            freshRequired = priorConversation !== undefined;
            break;
          case "click":
            since = new Date().toISOString();
            await checkpoint.target.click({ timeout });
            assertNativeHost(journey.page);
            break;
          case "attach": {
            const info = await stat(checkpoint.file);
            if (!info.isFile() || info.size > MAX_BYTES) throw new Outcome("failed", "fixture-too-large");
            const bytes = await readFile(checkpoint.file);
            if (bytes.length > MAX_BYTES) throw new Outcome("failed", "fixture-too-large");
            await controls.fileInput.setInputFiles({ name: basename(checkpoint.file), mimeType: checkpoint.mimeType, buffer: bytes }, { timeout });
            await checkpoint.ready.waitFor({ state: "visible", timeout });
            observation = { fileSha256: digest(bytes), bytes: bytes.length };
            break;
          }
          case "send": {
            if (pendingObservation) throw new Outcome("incomplete", "unobserved-turn");
            const before = await controls.assistantMessages.count();
            since = new Date().toISOString();
            await controls.composer.fill(checkpoint.prompt, { timeout });
            await controls.submit.click({ timeout });
            const reply = controls.assistantMessages.nth(before);
            await reply.waitFor({ state: "visible", timeout });
            const text = await completedReply(reply, controls.generating, timeout);
            assertNativeHost(journey.page);
            const conversation = conversationId(journey.page.url());
            if (!conversation || (freshRequired && conversation === priorConversation)) throw new Outcome("incomplete", "fresh-conversation-unconfirmed");
            if (await bounded(() => Promise.resolve(checkpoint.expectResponse(text)), timeout) !== true) throw new Outcome("failed", "response-assertion");
            priorConversation = conversation;
            freshRequired = false;
            pendingObservation = true;
            sentTurns += 1;
            observation = { promptSha256: digest(checkpoint.prompt), responseSha256: digest(text), conversationSha256: digest(conversation) };
            break;
          }
          case "visible":
            await checkpoint.target.waitFor({ state: "visible", timeout });
            break;
          case "image": {
            const box = await checkpoint.target.boundingBox();
            if (!box || box.width * box.height > 4_000_000) throw new Outcome("incomplete", "image-unavailable");
            const png = await checkpoint.target.screenshot({ type: "png", scale: "css", animations: "disabled", timeout });
            if (png.length > MAX_BYTES) throw new Outcome("failed", "image-too-large");
            if (await bounded(() => Promise.resolve(checkpoint.assertImage(Buffer.from(png))), timeout) !== true) throw new Outcome("failed", "image-assertion");
            const artifact = join(dirname(output), `${checkpoint.id}.png`);
            await privateFile(artifact, png);
            observation = { imageSha256: digest(png), bytes: png.length };
            break;
          }
          case "server-observation": {
            const calls = await bounded((signal) => checkpoint.collect({ runId: journey.runId, afterSequence: sequence, since, signal }), timeout);
            if (!Array.isArray(calls) || calls.length !== checkpoint.expectedCalls.length) throw new Outcome("incomplete", "server-observation-missing");
            const retained = calls.map((call, index) => {
              const expected = checkpoint.expectedCalls[index]!;
              if (call.nativeClient === "unverified") throw new Outcome("incomplete", "native-client-unverified");
              const observed = Date.parse(call.observedAt);
              if (call.nativeClient !== "verified-chatgpt" || !Number.isFinite(observed) || observed < Date.parse(since) - clockSkewMs || observed > Date.now() + clockSkewMs || call.runId !== journey.runId || call.endpointSha256 !== endpointSha256 || !Number.isSafeInteger(call.sequence) || call.sequence <= sequence) throw new Outcome("failed", "server-observation-scope");
              if (call.method !== expected.method || call.target !== expected.target || call.outcome !== expected.outcome || !SHA256.test(call.requestSha256) || !SHA256.test(call.responseSha256) || (expected.responseSha256 !== undefined && call.responseSha256 !== expected.responseSha256)) throw new Outcome("failed", "server-assertion");
              sequence = call.sequence;
              return { method: call.method, targetSha256: digest(call.target), requestSha256: call.requestSha256, responseSha256: call.responseSha256, outcome: call.outcome };
            });
            observedCalls += calls.length;
            pendingObservation = false;
            observation = { calls: retained, contractSha256: digest(JSON.stringify(checkpoint.expectedCalls)) };
            break;
          }
          case "application-state": {
            const state = await bounded(checkpoint.readState, timeout);
            if (state !== checkpoint.expectedSha256) throw new Outcome("failed", "application-state-assertion");
            observation = { stateSha256: state };
            break;
          }
        }
        assertNativeHost(journey.page);
        checkpoints.push(Object.freeze({ id: checkpoint.id, operation: checkpoint.operation, status: "passed", category: "verified", ...(observation ? { observation } : {}) }));
      } catch (error) {
        const outcome = error instanceof Outcome ? error : new Outcome("incomplete", "browser-or-observer-unavailable");
        checkpoints.push(Object.freeze({ id: checkpoint.id, operation: checkpoint.operation, status: outcome.status, category: outcome.category }));
        break;
      }
    }
    if (checkpoints.every((checkpoint) => checkpoint.status === "passed") && (pendingObservation || observedCalls === 0 || sentTurns === 0)) {
      checkpoints.push(Object.freeze({ id: "server-evidence", operation: "server-observation", status: "incomplete", category: "unobserved-turn" }));
    }
  } finally {
    try {
      const result = await bounded(journey.cleanup, timeout);
      const confirmed = result?.fixturesRemoved === true && result?.conversationsRemoved === true;
      checkpoints.push(Object.freeze({ id: "cleanup", operation: "cleanup", status: confirmed ? "passed" : "incomplete", category: confirmed ? "verified" : "cleanup-unconfirmed" }));
    } catch {
      checkpoints.push(Object.freeze({ id: "cleanup", operation: "cleanup", status: "incomplete", category: "cleanup-unconfirmed" }));
    }
  }
  const status = (["failed", "blocked", "incomplete"] as const).find((candidate) => checkpoints.some((checkpoint) => checkpoint.status === candidate)) ?? "passed";
  const evidence: NativeChatGptEvidence = Object.freeze({
    schemaVersion: 1, evidenceKind: "native-chatgpt-browser", status, runId: journey.runId, endpointSha256,
    ownershipSha256, clockSkewMs,
    startedAt, finishedAt: new Date().toISOString(), checkpoints: Object.freeze(checkpoints),
  });
  await privateFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

class Outcome extends Error {
  constructor(readonly status: NativeChatGptStatus, readonly category: string) { super(category); }
}

function assertNativeHost(page: Page): void {
  try { if (new URL(page.url()).origin === "https://chatgpt.com") return; } catch { /* No native host is observable. */ }
  throw new Outcome("blocked", "native-host-required");
}

function conversationId(url: string): string | undefined { return new URL(url).pathname.match(/\/c\/([A-Za-z0-9-]+)(?:\/|$)/)?.[1]; }

async function completedReply(reply: Locator, generating: Locator, timeout: number): Promise<string> {
  const end = Date.now() + timeout;
  let previous = "";
  let stableSince = Date.now();
  while (Date.now() < end) {
    const text = await reply.innerText({ timeout: Math.max(1, end - Date.now()) });
    if (Buffer.byteLength(text) > MAX_TEXT) throw new Outcome("incomplete", "response-too-large");
    if (text !== previous) { previous = text; stableSince = Date.now(); }
    if (text.trim() && !(await generating.isVisible()) && Date.now() - stableSince >= 1_000) return text;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Outcome("incomplete", "response-not-complete");
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, timeout: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Outcome("incomplete", "observation-timeout")); }, timeout); });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), expired]); }
  finally { clearTimeout(timer!); }
}

async function privateFile(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

function validate(journey: NativeChatGptJourney, output: string): void {
  if (journey.enabled !== true) throw new TypeError("native ChatGPT browser testing must be explicitly enabled");
  const auth = journey.authorization;
  if (auth?.approved !== true || auth.fixturePolicy !== "synthetic" || [auth.accountOwner, auth.endpointOwner, auth.fixtureOwner, auth.cleanupOwner].some((owner) => typeof owner !== "string" || !owner.trim() || owner.length > 256)) throw new TypeError("approved account, endpoint, fixture, and cleanup ownership is required");
  if (!(auth.endpoint instanceof URL) || auth.endpoint.protocol !== "https:" || auth.endpoint.username || auth.endpoint.password || auth.endpoint.search || auth.endpoint.hash) throw new TypeError("an authorized HTTPS MCP endpoint without credentials is required");
  if (!ID.test(journey.runId) || typeof output !== "string" || !output || typeof journey.cleanup !== "function" || !journey.page || !Array.isArray(journey.checkpoints) || journey.checkpoints.length === 0 || journey.checkpoints.length > 64) throw new TypeError("a bounded native journey, private output, and cleanup are required");
  if (journey.timeoutMs !== undefined && (!Number.isSafeInteger(journey.timeoutMs) || journey.timeoutMs < 100 || journey.timeoutMs > 300_000)) throw new TypeError("native journey timeout must be between 100 and 300000 milliseconds");
  if (journey.clockSkewMs !== undefined && (!Number.isSafeInteger(journey.clockSkewMs) || journey.clockSkewMs < 0 || journey.clockSkewMs > 5_000)) throw new TypeError("native observation clock skew must be between 0 and 5000 milliseconds");
  const ids = new Set(["cleanup", "server-evidence"]);
  for (const checkpoint of journey.checkpoints) {
    if (!ID.test(checkpoint.id) || ids.has(checkpoint.id)) throw new TypeError("checkpoint IDs must be unique bounded identifiers");
    ids.add(checkpoint.id);
    if (checkpoint.operation === "click" || checkpoint.operation === "visible" || checkpoint.operation === "image") requireOwnedLocator(checkpoint.target, journey.page);
    if (checkpoint.operation === "attach") requireOwnedLocator(checkpoint.ready, journey.page);
    if (checkpoint.operation === "attach" && (typeof checkpoint.file !== "string" || !checkpoint.file || typeof checkpoint.mimeType !== "string" || !/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(checkpoint.mimeType))) throw new TypeError("a fixture file and MIME type are required");
    if (checkpoint.operation === "send" && (typeof checkpoint.prompt !== "string" || !checkpoint.prompt.trim() || Buffer.byteLength(checkpoint.prompt) > MAX_TEXT || typeof checkpoint.expectResponse !== "function")) throw new TypeError("a bounded prompt and response assertion are required");
    if (checkpoint.operation === "human" && typeof checkpoint.ready !== "function") throw new TypeError("human readiness observation is required");
    if (checkpoint.operation === "image" && typeof checkpoint.assertImage !== "function") throw new TypeError("an image assertion is required");
    if (checkpoint.operation === "application-state" && (!SHA256.test(checkpoint.expectedSha256) || typeof checkpoint.readState !== "function")) throw new TypeError("declared application state and an independent reader are required");
    if (checkpoint.operation === "server-observation") {
      if (typeof checkpoint.collect !== "function" || !Array.isArray(checkpoint.expectedCalls) || !checkpoint.expectedCalls.length || checkpoint.expectedCalls.length > 64) throw new TypeError("bounded server observations and declared expectations are required");
      for (const call of checkpoint.expectedCalls) if (!METHODS.has(call.method) || typeof call.target !== "string" || call.target.length > 4096 || !["success", "denied", "cancelled"].includes(call.outcome) || (call.responseSha256 !== undefined && !SHA256.test(call.responseSha256))) throw new TypeError("invalid server observation expectation");
    }
    if (!["human", "fresh-conversation", "click", "attach", "send", "visible", "image", "application-state", "server-observation"].includes(checkpoint.operation)) throw new TypeError("unknown native checkpoint operation");
  }
}

function requireOwnedLocator(locator: Locator, page: Page): void {
  if (!locator || typeof locator.page !== "function" || locator.page() !== page) throw new TypeError("native controls must belong to the authorized page");
}
