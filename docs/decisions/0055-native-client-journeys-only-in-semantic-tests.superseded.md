---
status: "proposed"
date: 2026-09-07
human-oversight: confirmed
oversight-date: 2026-09-07
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-07
supersedes: ["ADR-0054"]
superseded-by: ["ADR-0057"]
---

# Native Client Journeys Only in Semantic Tests

## Context and Problem Statement

Provider-native tool calls remove selection coaching, but ADR-0054 retained a
`prepare()` path that manually fetched MCP resources and prompts before giving
their material to the model. That path can still misrepresent what users see
because test code creates context that the native client did not obtain.

## Decision Drivers

- Qualify only behaviour a user can experience through the native MCP client.
- Prevent hidden test setup from making a capability easier for the model.
- Keep capability claims narrower than their evidence.
- Preserve deterministic protocol coverage where no native semantic journey is
  available.

## Considered Options

1. **Native client journeys only**: remove `prepare()` and make semantic tests
   exercise only native provider conversations.
2. **Retain prepared interpretation tests**: label them narrowly but continue
   injecting harness-collected material.
3. **Treat prepared tests as native evidence**: retain the current behaviour
   and broad capability claim.

## Decision Outcome

Chosen option: **"Native client journeys only"**, because semantic evidence
must represent what users of the MCP will actually experience.

`@emseepea/testing/semantic` does not expose `prepare()`. It sends user messages
through one isolated provider-native MCP conversation and observes native tool
events and final responses. It supplies no harness-collected MCP material.

Resources and prompts retain deterministic protocol tests. They do not receive
semantic qualification or an autonomous-use claim until the configured
provider offers a native, automatable journey that represents how users select
and consume them.

All isolation, allow-listing, call bounds, timeouts, cancellation, redacted
evidence, independent trials, and separate response-meaning judgments from
ADR-0054 remain.

## Consequences

### Good

- Semantic tests cannot pass because hidden setup supplied the needed material.
- Evidence and public claims describe the same native user journey.
- The testing API becomes smaller.

### Neutral

- Deterministic tests remain the qualification source for MCP resources and
  prompts.

### Bad

- The resources-and-prompts example has no LLM semantic claim for now.
- Native support must be added before semantic coverage can extend to resources
  or prompts.

## Confirmation

- The public testing API has no `prepare()` method.
- Semantic provider input contains only the exact user messages plus explicit
  application context supplied by the test author.
- No harness-collected MCP material is sent to the conversation model.
- Every semantic tool assertion comes from native provider tool-use events.
- Documentation clearly says resources and prompts have deterministic protocol
  coverage only until a representative native client journey exists.
- Tests fail if `prepare()` or synthetic selection guidance is reintroduced.

## Pros and Cons of the Options

### Native Client Journeys Only

- Good: Produces the most representative and honest evidence.
- Bad: Narrows current semantic capability coverage.

### Retain Prepared Interpretation Tests

- Good: Checks model understanding of resource and prompt content.
- Bad: The harness creates a journey the user may never experience.

### Treat Prepared Tests as Native Evidence

- Good: Preserves broad coverage claims.
- Bad: Misstates what the test proves.

## Reassessment Criteria

Reassess when a supported provider exposes native, automatable resource or
prompt interactions that match a real user journey without hidden preparation.
