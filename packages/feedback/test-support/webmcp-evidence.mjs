import assert from "node:assert/strict";

/** Check independent native-provider evidence against actual browser/backend effects. */
export function assertNativeCorrelation(providerOutcomes, events) {
  assert.equal(events.length, providerOutcomes.length, "Every provider call must have exactly one native browser execution");
  let feedbackCount = 0;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const outcome = providerOutcomes[index];
    assert.equal(event.sequence, index + 1);
    assert.equal(event.name, outcome.name);
    assert.deepEqual(event.arguments, outcome.arguments);
    assert.equal(outcome.isError, false);
    assert.notEqual(event.error, true);
    assert.notEqual(event.result?.isError, true);
    assert.ok(Array.isArray(event.result?.content), "Native execution must return a real MCP-shaped result");
    assert.equal(typeof event.nativeResult, "string");
    assert.deepEqual(JSON.parse(event.nativeResult), event.result, "The bridge must preserve the raw native result");
    assert.deepEqual(Array.isArray(outcome.result) ? outcome.result : outcome.result.content, event.result.content,
      "The provider must receive the actual native result");
    assert.match(event.browserVersion, /^\d+\./);
    if (event.name === "submit-feedback") {
      feedbackCount++;
      const id = event.result.structuredContent?.id;
      assert.equal(typeof id, "string");
      const stored = event.records.filter((record) => record.id === id);
      assert.equal(stored.length, 1, "A successful native receipt must identify exactly one authoritative record");
      assert.equal(stored[0].observation, outcome.arguments.observation);
      assert.equal(stored[0].detail, outcome.arguments.detail);
      assert.deepEqual(stored[0].context, outcome.arguments.context);
      assert.equal(stored[0].scope, "website-demo");
    } else {
      assert.equal(event.name, "search-pea-varieties", "Only native website task and feedback tools are allowed");
      assert.equal(event.search.query, outcome.arguments.query);
      const matches = event.result.structuredContent?.matches;
      assert.ok(Array.isArray(matches));
      for (const match of matches) assert.ok(event.search.visibleResult.includes(match), "Search matches must appear in the website");
    }
    assert.equal(event.records.length, feedbackCount, "Search cannot write feedback, and a submission cannot write twice");
  }
  return { calls: events.length, feedbackCount, browserVersions: [...new Set(events.map((event) => event.browserVersion))] };
}

/** Require the real requested limitation before recovery or a feedback claim. */
export function assertObservedSearchFriction(events, { feedbackRequired = false } = {}) {
  const limited = events.findIndex((event) => event.name === "search-pea-varieties" &&
    event.arguments.query.trim().toLowerCase() === "sugar snap" &&
    event.result.structuredContent?.matches?.length === 0 &&
    event.result.structuredContent?.interfaceNote?.includes("Search uses exact words only.") &&
    event.search.visibleResult.includes("No varieties found."));
  assert.ok(limited >= 0, "The agent must actually encounter the requested search limitation");
  const recovered = events.findIndex((event, index) => index > limited &&
    event.name === "search-pea-varieties" &&
    event.result.structuredContent?.matches?.includes("Highland Snap") &&
    event.search.visibleResult.includes("Highland Snap"));
  assert.ok(recovered > limited, "The agent must recover through a real successful website search");
  if (feedbackRequired) {
    const feedback = events.findIndex((event) => event.name === "submit-feedback");
    assert.ok(feedback > limited, "Feedback must follow the observed limitation");
  }
}

/** Each optional refinement removes words, giving a bound derived from the request. */
export function ordinaryEmptySearchBound(name) {
  assert.ok(typeof name === "string" && name.trim());
  return name.trim().split(/\s+/).length;
}

export function assertOrdinaryEmptySearch(events, name) {
  const words = (query) => query.trim().toLowerCase().split(/\s+/);
  let previousWords = words(name);
  assert.ok(events.length >= 1 && events.length <= ordinaryEmptySearchBound(name),
    "Empty search calls must follow the strictly shortening word-count bound");
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    assert.equal(event.name, "search-pea-varieties", "Ordinary empty searches cannot submit feedback");
    assert.equal(typeof event.arguments.query, "string");
    const currentWords = words(event.arguments.query);
    if (index === 0) {
      assert.deepEqual(currentWords, previousWords, "Search the full requested name first");
    } else {
      const previous = events[index - 1];
      assert.ok(previous.result.structuredContent.interfaceNote?.includes("Try a shorter search."),
        "A refinement must follow the actual shorter-search hint");
      assert.ok(currentWords.length < previousWords.length, "Each refinement must remove at least one word");
      assert.ok(previousWords.some((_, start) =>
        JSON.stringify(previousWords.slice(start, start + currentWords.length)) === JSON.stringify(currentWords)),
      "Refinements must retain contiguous whole words from the previous query");
    }
    assert.deepEqual(event.result.structuredContent.matches, [], "Every native result must actually be empty");
    assert.ok(event.search.visibleResult.startsWith("No varieties found."), "The website must visibly show an empty result");
    assert.deepEqual(event.records, [], "Ordinary searches must not write feedback");
    previousWords = currentWords;
  }
}
