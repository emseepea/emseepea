import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertNoNegativeFeedback, assertResponseContains, assertResponseMeaning,
  assertToolCallsWithOptionalFeedback, createConversation } from "@emseepea/testing/semantic";

const directory = new URL(`../../../artifacts/webmcp-model/${randomUUID()}/`, import.meta.url);
await mkdir(directory, { recursive: true, mode: 0o700 });
const paths = [1, 2, 3].map((trial) => fileURLToPath(new URL(`trial-${trial}.jsonl`, directory)));
const sourceSha256 = createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex");
console.info(`Native WebMCP model evidence: ${fileURLToPath(directory)}; source: ${sourceSha256}`);

test("website agent uses multiple bridged MCP tools to answer a dependent stock lookup and follow-up", async (t) => {
  const chat = await createConversation(t, { server: new URL("./server.mjs", import.meta.url),
    environment: (trial) => ({ WEBMCP_EVIDENCE_FILE: paths[trial - 1],
      ...(process.env.WEBMCP_CHROMIUM_PATH ? { WEBMCP_CHROMIUM_PATH: process.env.WEBMCP_CHROMIUM_PATH } : {}) }),
  });
  const recorded = [[], [], []];
  async function correlate(turn) {
    const checkpoints = [];
    for (let trial = 0; trial < 3; trial++) {
      recorded[trial].push(...turn.toolOutcomes[trial]);
      const text = await readFile(paths[trial], "utf8");
      const events = text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
      assert.equal(events.length, recorded[trial].length);
      for (let i = 0; i < events.length; i++) {
        const event = events[i], outcome = recorded[trial][i];
        assert.equal(event.failed, false);
        assert.equal(event.name, outcome.name);
        assert.deepEqual(event.arguments, outcome.arguments);
        assert.deepEqual(event.result.content, outcome.result);
        assert.equal(Boolean(event.result.isError), outcome.isError);
        assert.deepEqual(JSON.parse(event.rawResult), event.result);
        assert.deepEqual(JSON.parse(event.visibleResult), event.result);
        assert.equal(event.sequence, i + 1);
        assert.equal(event.backend.length, i + 1);
        const backend = event.backend.at(-1);
        assert.equal(backend.name, event.name);
        assert.deepEqual(JSON.parse(JSON.stringify(backend.arguments)), event.arguments);
        if (event.name !== "submit-feedback") {
          assert.deepEqual(backend.data, event.result.structuredContent);
        } else assert.equal(backend.data.id, event.result.structuredContent.id);
      }
      checkpoints.push({ trial: trial + 1, calls: events.length,
        evidenceSha256: createHash("sha256").update(text).digest("hex") });
    }
    await writeFile(new URL(`checkpoint-${recorded[0].length}.json`, directory),
      JSON.stringify({ sourceSha256, checkpoints }, null, 2), { mode: 0o600 });
  }
  const first = await chat.send("Look up Highland Snap and its stock batch. Tell me the pea type, maturity in days, and how many seed packets are available.");
  await assertToolCallsWithOptionalFeedback(first, [
    { name: "lookup-variety", arguments: { name: "Highland Snap" } },
    { name: "get-batch-stock", arguments: { batchId: "HS-27" } },
  ]);
  assertResponseContains(first, "Highland Snap");
  assertNoNegativeFeedback(first);
  await correlate(first);
  await assertResponseMeaning(first, { expected: "Highland Snap is a snap pea, matures in 70 days, and has 12 seed packets available. The response answers the requested variety and stock lookup." });
  const second = await chat.send("Now do the same lookup for Harbour Gem and compare its maturity and packet availability with Highland Snap.");
  await assertToolCallsWithOptionalFeedback(second, [
    { name: "lookup-variety", arguments: { name: "Harbour Gem" } },
    { name: "get-batch-stock", arguments: { batchId: "HG-14" } },
  ]);
  assertResponseContains(second, "Harbour Gem");
  assertNoNegativeFeedback(first, second);
  await correlate(second);
  await assertResponseMeaning(second, { expected: "Harbour Gem is a shelling pea, matures in 62 days, and has 8 seed packets available. Highland Snap matures in 70 days and has 12 packets. The response compares the two varieties without mixing their values." });
});
