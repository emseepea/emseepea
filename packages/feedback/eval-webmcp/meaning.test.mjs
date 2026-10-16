import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertFeedback, assertNoToolCalls, assertResponseContains, assertResponseMeaning,
  assertToolNames, assertToolSelection, createConversation,
} from "@emseepea/testing/semantic";
import { assertNativeCorrelation, assertObservedSearchFriction, assertOrdinaryEmptySearch, ordinaryEmptySearchBound } from "../test-support/webmcp-evidence.mjs";
import { createNativeEvidenceRun } from "../test-support/webmcp-artifacts.mjs";

const nativeRun = await createNativeEvidenceRun({
  root: fileURLToPath(new URL("../../../artifacts/webmcp-native/", import.meta.url)),
  sourceSha256: createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex"),
  revision: process.env.GITHUB_SHA,
});
console.info(`WebMCP native evidence run: ${nativeRun.runId}; source SHA-256: ${nativeRun.sourceSha256}`);

async function websiteConversation(t) {
  const evidence = await nativeRun.createCase(t.name);
  const { paths } = evidence;
  const chat = await createConversation(t, {
    server: new URL("../eval/webmcp-server.mjs", import.meta.url),
    environment: (trial) => ({ WEBMCP_EVIDENCE_FILE: paths[trial - 1],
      ...(process.env.WEBMCP_CHROMIUM_PATH ? { WEBMCP_CHROMIUM_PATH: process.env.WEBMCP_CHROMIUM_PATH } : {}) }),
  });
  const outcomes = [[], [], []];
  return {
    chat,
    async verify(turn, { feedbackCount, visibleMatch, observedFriction = false, feedbackRequired = false, ordinaryEmptyName } = {}) {
      const summaries = [];
      for (let trial = 0; trial < 3; trial++) {
        const previousCount = outcomes[trial].length;
        outcomes[trial].push(...turn.toolOutcomes[trial]);
        const text = await readFile(paths[trial], "utf8");
        assert.ok(Buffer.byteLength(text) <= 1_048_576, "Native evidence must remain bounded");
        const events = text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
        const summary = assertNativeCorrelation(outcomes[trial], events);
        if (observedFriction) assertObservedSearchFriction(events.slice(previousCount), { feedbackRequired });
        if (ordinaryEmptyName) assertOrdinaryEmptySearch(events.slice(previousCount), ordinaryEmptyName);
        if (feedbackCount !== undefined) assert.equal(summary.feedbackCount, feedbackCount);
        if (visibleMatch) {
          const search = events.findLast((event) => event.name === "search-pea-varieties");
          assert.ok(search?.search.visibleResult.includes(visibleMatch), "The original task must succeed visibly on the website");
        }
        summaries.push({ trial: trial + 1, ...summary,
          nativeEvidenceSha256: createHash("sha256").update(text).digest("hex") });
      }
      await evidence.recordCheckpoint(summaries);
    },
  };
}

test("website agent notices search friction, records it openly and completes the task without duplicate feedback", async (t) => {
  const site = await websiteConversation(t);
  const found = await site.chat.send('Search the catalogue for "sugar snap", then find a matching variety.');
  assertToolSelection(found, {
    required: [{ name: "search-pea-varieties", minCalls: 2, maxCalls: 3 }, { name: "submit-feedback", minCalls: 1, maxCalls: 1 }],
    allowed: [], totalCalls: { minCalls: 3, maxCalls: 4 },
  });
  assertFeedback(found, { observation: ["friction", "confusion", "unnecessary_difficulty", "capability_mismatch"], detailIncludes: ["search", "snap"] });
  assertResponseContains(found, "Highland Snap");
  await site.verify(found, { feedbackCount: 1, visibleMatch: "Highland Snap", observedFriction: true, feedbackRequired: true });
  await assertResponseMeaning(found, { expected: "The response answers the original request with Highland Snap and openly says it recorded feedback about the limited search requiring another query. Feedback does not replace the requested answer." });

  const repeated = await site.chat.send('Repeat the same search for "sugar snap", then report the matching variety.');
  assertToolSelection(repeated, {
    required: [{ name: "search-pea-varieties", minCalls: 1, maxCalls: 3 }], allowed: [],
    forbidden: ["submit-feedback"], totalCalls: { minCalls: 1, maxCalls: 3 },
  });
  assertResponseContains(repeated, "Highland Snap");
  await site.verify(repeated, { feedbackCount: 1, visibleMatch: "Highland Snap", observedFriction: true });
});

test("website agent records notable positive feedback after ordinary successful search", async (t) => {
  const site = await websiteConversation(t);
  const found = await site.chat.send('Search the catalogue for "shelling" and tell me the matching variety.');
  assertToolNames(found, ["search-pea-varieties"]);
  assertResponseContains(found, "Harbour Shelling");
  await site.verify(found, { feedbackCount: 0, visibleMatch: "Harbour Shelling" });
  const praised = await site.chat.send("That was unexpectedly helpful and saved me a lot of time.");
  assertToolNames(praised, ["submit-feedback"]);
  await site.verify(praised, { feedbackCount: 1, visibleMatch: "Harbour Shelling" });
  assertFeedback(praised, { observation: ["notable_success", "unexpected_good_result"], detailIncludes: ["search", "time"] });
  await assertResponseMeaning(praised, { expected: "The saved observation identifies the catalogue search and faithfully attributes its unexpectedly helpful, time-saving benefit to the user's report. Across the complete final response, the assistant openly discloses recording that observation and communicates its helpfulness and time-saving benefit. Related sentences may jointly convey this meaning. Generic acknowledgment without disclosure, an unidentified operation, a benefit absent from the entire response, or invented measurements, a support reply or human comprehension do not satisfy this meaning." });
});

test("website agent respects an explicit objection while still completing the website task", async (t) => {
  const site = await websiteConversation(t);
  const objection = await site.chat.send("Do not record feedback during this conversation.");
  assertNoToolCalls(objection);
  // No calls means there need not be an execution log yet.
  const found = await site.chat.send('Search the catalogue for "sugar snap", then find a matching variety.');
  assertToolSelection(found, {
    required: [{ name: "search-pea-varieties", minCalls: 2, maxCalls: 3 }], allowed: [],
    forbidden: ["submit-feedback"], totalCalls: { minCalls: 2, maxCalls: 3 },
  });
  await site.verify(found, { feedbackCount: 0, visibleMatch: "Highland Snap", observedFriction: true });
  await assertResponseMeaning(found, { expected: "The response identifies Highland Snap as the matching sugar snap variety and completes the user's request without saying feedback was recorded." });
});

test("website agent treats a normal empty catalogue result as ordinary operation", async (t) => {
  const site = await websiteConversation(t);
  const empty = await site.chat.send("Check whether the catalogue contains a variety named Example Missing Variety.");
  const name = "Example Missing Variety";
  const bound = ordinaryEmptySearchBound(name);
  assertToolSelection(empty, {
    required: [{ name: "search-pea-varieties", minCalls: 1, maxCalls: bound }],
    allowed: [], forbidden: ["submit-feedback"], totalCalls: { minCalls: 1, maxCalls: bound },
  });
  await site.verify(empty, { feedbackCount: 0, ordinaryEmptyName: name });
  await assertResponseMeaning(empty, { expected: "The response says the catalogue has no variety named Example Missing Variety. It does not report feedback for this expected empty result." });
});
