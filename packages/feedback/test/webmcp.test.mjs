import assert from "node:assert/strict";
import test from "node:test";
import { registerFeedbackWebMcp } from "@emseepea/feedback/webmcp";

const guidance = "Call this tool before answering when there is notable friction. " +
  "Do not ask a separate permission question. Disclose the observation and continue the original task. " +
  "Do not record ordinary operation, duplicates, or anything after an objection.";
const tool = {
  name: "submit-feedback", title: "Record Detailed Feedback", description: guidance,
  inputSchema: { type: "object", properties: { observation: { type: "string" }, detail: { type: "string", maxLength: 4000 } }, additionalProperties: false },
};
const receipt = { isError: false, content: [{ type: "text", text: "Recorded" }], structuredContent: {
  id: "feedback-1", recordedAt: "2026-10-16T00:00:00Z", nextAction: "Answer the original request, then disclose the specific feedback recorded.",
} };

function fixture(overrides = {}) {
  let registered;
  const calls = [];
  const registrations = new Map();
  const modelContext = {
    async getTools() { return [...registrations.values()]; },
    async registerTool(definition, { signal }) {
      if (registrations.has(definition.name)) throw new Error("collision");
      registered = definition;
      registrations.set(definition.name, definition);
      signal.addEventListener("abort", () => {
        if (registrations.get(definition.name) === definition) registrations.delete(definition.name);
      }, { once: true });
    },
  };
  const client = {
    async listTools() { return { tools: [tool] }; },
    async callTool(request, options) { calls.push({ request, options }); return receipt; },
    ...overrides,
  };
  return { client, modelContext, calls, registrations, get registered() { return registered; } };
}

test("browser bridge is absent without native support and makes no discovery requests", async () => {
  let discovered = false;
  const result = await registerFeedbackWebMcp({ client: { listTools() { discovered = true; } } });
  assert.deepEqual(result, { available: false });
  assert.equal(discovered, false);
});

test("preserves active guidance, exact schema, arguments and receipt; registers no other tools", async () => {
  const f = fixture({ async listTools() { return { tools: [tool, { ...tool, name: "get-feedback-submission" }] }; } });
  const registration = await registerFeedbackWebMcp(f);
  assert.equal(registration.available, true);
  assert.deepEqual([...f.registrations.keys()], ["submit-feedback"]);
  assert.equal(f.registered.description, guidance);
  assert.deepEqual(f.registered.inputSchema, tool.inputSchema);
  assert.deepEqual(f.registered.annotations, { readOnlyHint: false, consequentialHint: false, untrustedContentHint: true });
  const args = { observation: "friction", detail: "The filter required three attempts." };
  assert.deepEqual(JSON.parse(await f.registered.execute(args)), receipt);
  assert.deepEqual(f.calls[0].request, { name: "submit-feedback", arguments: args });
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].options.signal instanceof AbortSignal);
  registration.dispose();
  assert.equal(f.registrations.size, 0);
  assert.equal(JSON.parse(await f.registered.execute(args)).outcome, "not-submitted");
  assert.equal(f.calls.length, 1);
});

test("trusted selection supports collection names without registering operators", async () => {
  const selected = { ...tool, name: "submit-customer-feedback" };
  const f = fixture({ async listTools() { return { tools: [tool, selected] }; } });
  const registration = await registerFeedbackWebMcp({ ...f, toolName: selected.name });
  assert.deepEqual([...f.registrations.keys()], [selected.name]);
  await f.registered.execute({ observation: "suggestion", detail: "Keep the filter visible." });
  assert.equal(f.calls[0].request.name, selected.name);
  registration.dispose();
  await assert.rejects(registerFeedbackWebMcp({ ...f, toolName: "get-feedback-submission" }), /configured feedback submission/);
});

test("name collisions and absent/malformed contracts fail without affecting existing tools", async () => {
  const f = fixture();
  const first = await registerFeedbackWebMcp(f);
  const owner = f.registered;
  await assert.rejects(registerFeedbackWebMcp(f), /registration failed/);
  assert.equal(f.registrations.get(tool.name), owner);
  first.dispose();
  for (const tools of [[], [{ ...tool, description: undefined }], [{ ...tool, inputSchema: { type: "array" } }], [tool, tool]]) {
    const broken = fixture({ async listTools() { return { tools }; } });
    await assert.rejects(registerFeedbackWebMcp(broken), /registration failed/);
    assert.equal(broken.registrations.size, 0);
    assert.equal(broken.calls.length, 0);
  }
});

test("bounded pagination finds configured feedback and stops cyclic discovery", async () => {
  const cursors = [];
  const f = fixture({ async listTools(params) {
    cursors.push(params?.cursor);
    return params?.cursor ? { tools: [tool] } : { tools: [], nextCursor: "page-two" };
  } });
  const registration = await registerFeedbackWebMcp(f);
  assert.deepEqual(cursors, [undefined, "page-two"]);
  registration.dispose();
  let pages = 0;
  const cycle = fixture({ async listTools() { pages++; return { tools: [], nextCursor: "cycle" }; } });
  await assert.rejects(registerFeedbackWebMcp(cycle), /registration failed/);
  assert.equal(pages, 2);
  let endless = 0;
  const long = fixture({ async listTools() { return { tools: [], nextCursor: String(++endless) }; } });
  await assert.rejects(registerFeedbackWebMcp(long), /registration failed/);
  assert.equal(endless, 8);
});

test("pre-abort and discovery timeout register nothing, without leaking raw errors", async () => {
  const f = fixture({ async listTools() { throw new Error("private-access-token"); } });
  await assert.rejects(registerFeedbackWebMcp(f), (error) => !error.message.includes("private-access-token"));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(registerFeedbackWebMcp({ ...fixture(), signal: controller.signal }), /registration failed/);
  let discoveredSignal;
  const stalled = fixture({ listTools(_params, options) { discoveredSignal = options.signal; return new Promise(() => {}); } });
  await assert.rejects(registerFeedbackWebMcp({ ...stalled, timeoutMs: 15 }), /registration failed/);
  assert.equal(discoveredSignal.aborted, true);
  assert.equal(stalled.registrations.size, 0);
});

test("disposing during discovery cancels the request and never registers later", async () => {
  const external = new AbortController();
  const started = Promise.withResolvers();
  const finish = Promise.withResolvers();
  const f = fixture({ listTools(_params, { signal }) { started.resolve(signal); return finish.promise; } });
  const pending = registerFeedbackWebMcp({ ...f, signal: external.signal });
  const signal = await started.promise;
  external.abort();
  await assert.rejects(pending, /registration failed/);
  assert.equal(signal.aborted, true);
  finish.resolve({ tools: [tool] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.registrations.size, 0);
});

test("oversized or non-JSON input is rejected before dispatch; no implicit context", async () => {
  const f = fixture();
  const registration = await registerFeedbackWebMcp(f);
  const circular = {}; circular.self = circular;
  for (const input of [null, [], circular, { detail: "x".repeat(65_537) }]) {
    assert.equal(JSON.parse(await f.registered.execute(input)).outcome, "not-submitted");
  }
  assert.equal(f.calls.length, 0);
  await f.registered.execute({ observation: "friction", detail: "Slow filter." });
  assert.deepEqual(Object.keys(f.calls[0].request.arguments).sort(), ["detail", "observation"]);
  registration.dispose();
});

test("tool errors, malformed receipts and transport failures never claim success or retry", async () => {
  for (const result of [{ ...receipt, isError: true }, { content: [] }, { ...receipt, content: ["x".repeat(262_145)] }]) {
    let calls = 0;
    const f = fixture({ async callTool() { calls++; return result; } });
    const registration = await registerFeedbackWebMcp(f);
    const failed = JSON.parse(await f.registered.execute({ detail: "Slow filter." }));
    assert.equal(failed.isError, true);
    assert.equal(failed.outcome, "unknown");
    assert.match(failed.nextAction, /may already have been saved.*Do not automatically retry/);
    assert.equal(calls, 1);
    registration.dispose();
  }
  let calls = 0;
  const f = fixture({ async callTool() { calls++; throw new Error("private-token-and-query"); } });
  const registration = await registerFeedbackWebMcp(f);
  assert.doesNotMatch(await f.registered.execute({ detail: "Slow filter." }), /private-token-and-query/);
  assert.equal(calls, 1);
  registration.dispose();
});

test("one write stays in flight if a client ignores cancellation; disposal never closes it", async () => {
  const started = Promise.withResolvers();
  const finish = Promise.withResolvers();
  let calls = 0;
  let closed = false;
  const f = fixture({ callTool(_args, { signal }) { calls++; started.resolve(signal); return finish.promise; }, close() { closed = true; } });
  const registration = await registerFeedbackWebMcp({ ...f, timeoutMs: 20 });
  const pending = f.registered.execute({ detail: "Slow filter." });
  const signal = await started.promise;
  const busy = JSON.parse(await f.registered.execute({ detail: "Slow filter." }));
  assert.equal(busy.outcome, "not-submitted");
  const failed = JSON.parse(await pending);
  assert.equal(failed.outcome, "unknown");
  assert.equal(signal.aborted, true);
  assert.equal(JSON.parse(await f.registered.execute({ detail: "Slow filter." })).outcome, "not-submitted");
  assert.equal(calls, 1);
  registration.dispose();
  finish.resolve(receipt);
  assert.equal(closed, false);
});

test("account teardown aborts an ongoing write and invalidates the old registration", async () => {
  const started = Promise.withResolvers();
  const f = fixture({ callTool(_args, { signal }) { started.resolve(signal); return new Promise(() => {}); } });
  const registration = await registerFeedbackWebMcp(f);
  const pending = f.registered.execute({ detail: "Slow filter." });
  const signal = await started.promise;
  registration.dispose();
  assert.equal(signal.aborted, true);
  assert.equal(JSON.parse(await pending).outcome, "unknown");
  assert.equal(f.registrations.size, 0);
});
