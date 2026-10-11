---
status: "proposed"
date: 2026-10-11
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["wr-architect:agent", "wr-jtbd:agent"]
informed: []
reassessment-date: 2027-01-11
---

# Read-Only Native Tool Outcomes on Semantic Conversation Turns

> Captured via `/wr-architect:capture-adr`. Tom Howard directed the reported
> Coglen qualification gap to be fixed first. The decision remains unconfirmed
> until he ratifies it after successful production-use evidence is available.

## Context and Problem Statement

Semantic evidence already retains each native tool call's model-visible result
and `isError` flag. The public `ConversationTurn`, however, exposes only names
and arguments. A test cannot directly distinguish an expected validation error
that the model corrected from an unresolved mutation error without reaching
into saved evidence after teardown.

The public turn needs a bounded view of the outcomes the model actually saw.
That view must not expose provider events or mutable references to private
runner state, and it must not claim that an error was recovered or an
application effect was correct.

## Decision Drivers

- Let ordinary test assertions inspect the same model-visible outcomes that
  retained evidence records.
- Preserve trial and call order so an assertion can correlate selection and
  outcome exactly.
- Prevent adopter code from mutating private runner state or saved evidence.
- Expose no credentials, transport details, paths, provider events, or hidden
  configuration.
- Keep application-effect and recovery judgments in adopter assertions.

## Considered Options

1. **Detached read-only outcome snapshots (chosen)**: expose an aligned public
   outcome view containing only the model-visible fields.
2. **Framework-owned effect assertions**: add a new generalized effect and
   recovery judgment API.
3. **Evidence-file access only**: keep results unavailable during the test.

## Decision Outcome

Chosen option: **"Detached read-only outcome snapshots"**, because it exposes
the already retained observation without making the framework own application
effect semantics.

Add `toolOutcomes` to `ConversationTurn`. Like `toolCalls`, its outer array is
ordered by trial and each inner array is ordered by native call index. Every
entry contains only `name`, detached `arguments`, detached model-visible
`result`, and `isError`.

The view is recursively immutable or mutation-isolated. Changing an object
obtained from the public turn cannot change another trial, private runner
state, the assertion inputs, or retained evidence. The harness adds no raw
provider events, MCP address, headers, environment values, transport
configuration, filesystem paths, stderr, or other harness-private fields. The
model-visible result is preserved exactly and may contain application data, so
fixtures remain responsible for using non-sensitive synthetic content under
ADR-0057.

`toolOutcomes` is an observation, not a verdict. A successful result does not
prove that the expected application effect occurred. An error result does not
prove that the model recovered. Adopter assertions must decide those facts and
must continue to inspect persisted application state where the effect matters.
The existing saved-evidence and redaction boundaries remain unchanged.

## Consequences

### Good

- Tests can assert expected error recovery before teardown.
- The public turn and saved evidence describe the same concrete call outcomes.
- The framework does not need application-specific effect callbacks.

### Neutral

- Existing `toolCalls` consumers continue to receive names and arguments.
- Retained evidence already stores the exposed model-visible fields.

### Bad

- Test authors can inspect synthetic result content in memory and must keep
  semantic fixtures non-sensitive.
- Callers must write their own recovery and persisted-effect assertions.

## Confirmation

- The three trial arrays and every call index align between `toolCalls`,
  `toolOutcomes`, and retained evidence.
- Successful and `isError` results expose only the four documented fields.
- Nested mutation attempts cannot alter private state, later assertions, or
  retained evidence.
- No additional harness- or provider-private fields appear beyond the four
  documented fields; synthetic fixtures keep model-visible results
  non-sensitive.
- Existing conversation-turn and exact-assertion APIs remain compatible.
- An independently installed package proves expected-error recovery using the
  public view before the decision is eligible for confirmation.

## Reassessment Criteria

Reassess if model-visible result content cannot be detached safely, if the view
is mistaken for effect verification, or if a separate generalized effect
assertion becomes necessary.
