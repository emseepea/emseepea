import assert from "node:assert/strict";
import test from "node:test";
import { assertNativeCorrelation, assertObservedSearchFriction, assertOrdinaryEmptySearch, ordinaryEmptySearchBound } from "../test-support/webmcp-evidence.mjs";

function fixture() {
  const args = { observation: "friction", detail: "The search required another query." };
  const result = { content: [{ type: "text", text: "Receipt" }], structuredContent: { id: "feedback-1" } };
  const outcomes = [{ name: "submit-feedback", arguments: args, result: result.content, isError: false }];
  const events = [{ sequence: 1, name: "submit-feedback", arguments: args, result, nativeResult: JSON.stringify(result), browserVersion: "154.0.8037.57",
    records: [{ id: "feedback-1", scope: "website-demo", ...args }] }];
  return { outcomes, events };
}

test("correlation requires native results and one exact authoritative feedback write", () => {
  const { outcomes, events } = fixture();
  assert.deepEqual(assertNativeCorrelation(outcomes, events), { calls: 1, feedbackCount: 1, browserVersions: ["154.0.8037.57"] });
  for (const alter of [
    (e) => e.pop(),
    (e) => { e[0].arguments.detail = "Different native arguments"; },
    (e) => { e[0].result.content[0].text = "Invented result"; },
    (e) => { e[0].nativeResult = JSON.stringify({ content: [] }); },
    (e) => { e[0].records[0].id = "different-receipt"; },
    (e) => { e[0].records.push({ ...e[0].records[0] }); },
    (e) => { e[0].records[0].scope = "another-account"; },
    (e) => { e[0].result.isError = true; },
  ]) {
    const modified = structuredClone(events);
    alter(modified);
    assert.throws(() => assertNativeCorrelation(outcomes, modified));
  }
});

test("task completion requires actual visible website matches and no unexpected feedback", () => {
  const outcome = { name: "search-pea-varieties", arguments: { query: "snap" }, isError: false,
    result: [{ type: "text", text: "Highland Snap" }] };
  const event = { sequence: 1, name: outcome.name, arguments: outcome.arguments,
    result: { content: outcome.result, structuredContent: { matches: ["Highland Snap"] } },
    search: { query: "snap", visibleResult: "Found: Highland Snap." }, records: [], browserVersion: "154.0.8037.57" };
  event.nativeResult = JSON.stringify(event.result);
  assertNativeCorrelation([outcome], [event]);
  assert.throws(() => assertNativeCorrelation([outcome], [{ ...event, search: { query: "snap", visibleResult: "No result" } }]));
  assert.throws(() => assertNativeCorrelation([outcome], [{ ...event, records: [{ id: "unexpected" }] }]));
});

test("friction qualification requires a real observed limitation before feedback and actual recovery", () => {
  const limited = { name: "search-pea-varieties", arguments: { query: "sugar snap" },
    result: { structuredContent: { matches: [], interfaceNote: "Search uses exact words only. Try “snap”." } },
    search: { visibleResult: "No varieties found. Search uses exact words only." } };
  const recovered = { name: "search-pea-varieties", arguments: { query: "snap" },
    result: { structuredContent: { matches: ["Highland Snap"] } }, search: { visibleResult: "Found: Highland Snap." } };
  const feedback = { name: "submit-feedback" };
  assertObservedSearchFriction([limited, feedback, recovered], { feedbackRequired: true });
  assertObservedSearchFriction([limited, recovered]);
  assert.throws(() => assertObservedSearchFriction([feedback, limited, recovered], { feedbackRequired: true }));
  assert.throws(() => assertObservedSearchFriction([recovered, feedback, recovered], { feedbackRequired: true }));
  assert.throws(() => assertObservedSearchFriction([limited, feedback], { feedbackRequired: true }));
});

function emptySearch(query, hint = "Try a shorter search.") {
  return { name: "search-pea-varieties", arguments: { query }, records: [],
    result: { structuredContent: { matches: [], interfaceNote: hint } },
    search: { visibleResult: `No varieties found. ${hint}` } };
}

test("ordinary empty search permits only hinted whole-word shortening with a request-derived bound", () => {
  const name = "Example Missing Variety";
  assert.equal(ordinaryEmptySearchBound(name), 3);
  assert.equal(ordinaryEmptySearchBound("Example"), 1);
  assertOrdinaryEmptySearch([emptySearch(name)], name);
  assertOrdinaryEmptySearch([emptySearch(name), emptySearch("Example")], name);
  assertOrdinaryEmptySearch([emptySearch(name), emptySearch("Missing Variety"), emptySearch("Variety")], name);
  for (const events of [
    [], [emptySearch("Example")],
    [emptySearch(name), emptySearch(name)],
    [emptySearch(name), emptySearch("Unrelated")],
    [emptySearch(name), emptySearch("Example Variety")],
    [emptySearch(name), emptySearch("Exam")],
    [emptySearch(name, "No refinement hint."), emptySearch("Example")],
    [emptySearch(name), emptySearch("Example"), emptySearch("Example")],
    [emptySearch(name), emptySearch("Missing Variety"), emptySearch("Variety"), emptySearch("Variety")],
    [{ ...emptySearch(name), name: "submit-feedback" }],
    [{ ...emptySearch(name), records: [{ id: "unexpected-write" }] }],
    [{ ...emptySearch(name), result: { structuredContent: { matches: ["invented match"] } } }],
    [{ ...emptySearch(name), search: { visibleResult: "Found: invented match." } }],
  ]) assert.throws(() => assertOrdinaryEmptySearch(events, name));
});
