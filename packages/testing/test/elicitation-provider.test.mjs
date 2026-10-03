import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { startModelConversation } from "../semantic/provider.mjs";

async function model(t) {
  const directory = await mkdtemp(join(tmpdir(), "elicitation-provider-"));
  const previous = process.env.EMSEEPEA_MODEL_COMMAND;
  process.env.EMSEEPEA_MODEL_COMMAND = fileURLToPath(new URL("./elicitation-model.mjs", import.meta.url));
  const conversation = startModelConversation("claude-local", directory,
    "http://127.0.0.1:1234/mcp", [{ name: "create" }], "synthetic-server-token");
  t.after(async () => {
    await conversation.close();
    await rm(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.EMSEEPEA_MODEL_COMMAND;
    else process.env.EMSEEPEA_MODEL_COMMAND = previous;
  });
  return conversation;
}

for (const action of ["accept", "cancel", "decline"]) test(`native adapter supplies only explicit ${action} through control response`, async (t) => {
  const conversation = await model(t);
  const turn = await conversation.send("create", { elicitations: [{
    messageIncludes: ["Create Synthetic Customer?"], response: { action },
  }] });
  assert.equal(turn.answer, action);
  assert.deepEqual(turn.elicitations[0].response, { action });
  assert.equal(turn.calls[0].name, "create");
  assert.ok(!JSON.stringify(turn).includes("provider-envelope-sentinel"));
});

test("unconfigured control requests fail promptly with request evidence", async (t) => {
  const conversation = await model(t);
  await assert.rejects(conversation.send("create"), (error) => {
    assert.match(error.message, /Unexpected/);
    assert.equal(error.elicitations[0].message, "Create Synthetic Customer?");
    assert.equal(error.elicitations[0].response, undefined);
    return true;
  });
});

test("a repeated provider control ID cannot reuse a confirmation", async (t) => {
  const conversation = await model(t);
  await assert.rejects(conversation.send("duplicate", { elicitations: [{
    messageIncludes: ["Synthetic Customer"], response: { action: "accept" },
  }] }), /Unexpected native control request/);
});

test("a completed native turn fails if an expected user interaction was omitted", async (t) => {
  const conversation = await model(t);
  await assert.rejects(conversation.send("create", { elicitations: [
    { messageIncludes: ["Synthetic Customer"], response: { action: "cancel" } },
    { messageIncludes: ["Other Customer"], response: { action: "accept" } },
  ] }), /Unused scripted elicitation/);
});
