---
status: "proposed"
date: 2026-10-09
human-oversight: confirmed
oversight-date: 2026-10-09
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-09
---

# Native Semantic Conversations Without a Tool-Call Count Limit

## Context and Problem Statement

[Issue #150](https://github.com/emseepea/emseepea/issues/150) reports that
native semantic conversations reject a fourth advertised MCP tool call.
Legitimate journeys can need several independent reads or a validation retry.
A parser rejection after execution cannot prevent those calls' effects.

The original draft proposed a configurable count budget. Tom Howard rejected
that approach and explicitly directed: "Remove the limit." This record captures
that decision and replaces the unratified draft.

## Decision Drivers

- Qualify real application journeys without an arbitrary call-count ceiling.
- Preserve advertised-tool restrictions and exact application assertions.
- Retain independent execution limits and provider-native evidence.
- Do not retry failed semantic trials or weaken acceptance assertions.

## Considered Options

1. **Remove the tool-call count limit**.
2. **Add a configurable count budget**.
3. **Keep the three-call ceiling**.

## Decision Outcome

Chosen option: **"Remove the tool-call count limit"**.

Remove the three-call rejection from the native Claude and Codex parsers
and from the CLI evidence validator. The final validator must not reimpose
a ceiling after successful native execution. Validate call-count consistency
and positive integer provider-turn evidence without a calls-plus-one formula.
Introduce no `maxToolCalls` option, replacement ceiling, or environment override.
Remove Claude's native conversation `--max-turns 4` flag as well. The first
release candidate retained it and added a four-turn parser check. All three
live four-read trials were rejected by that parser check with
`model command exceeded its turn limit`. A turn-count ceiling must not replace
the removed call-count ceiling. The saved evidence is in
[the failed Release run](https://github.com/emseepea/emseepea/actions/runs/37922640488).

Accept positive integer native provider-turn counts without a framework
ceiling or a one-tool-per-round assumption. Record `maxTurns: null` and
`judgeMaxTurns: 4` in Claude qualification settings. Tool-free judges keep
their four-turn invocation flag and single-answer validation.

Existing time, token, output-size, cancellation, isolation,
advertised-tool, argument, result, and model checks remain effective. Judge
invocations continue to forbid tool use. Three fresh answer trials and
independent meaning judgments remain required under ADR-0057.

Successful native calls retain their existing arguments, results, and hashed
protocol evidence under the established synthetic-fixture privacy policy.
The obsolete count-exhaustion failure disappears. This change does not promise
new transcripts for unrelated provider failures or remove existing redaction.
It supplements the native semantic boundary; it does not change application
tool execution or provide rollback for effects.

## Consequences

### Good

- Valid batches of four or more calls can qualify without configuration.
- Provider execution no longer retains the former ceiling indirectly.

### Bad

- A model may make more calls within the existing execution allowance.
- Timeouts and provider output/context limits still constrain journeys. This
  decision does not promise unlimited execution or remove those controls.

## Confirmation

- Claude and Codex parser checks accept more than three advertised calls and
  preserve each call's result and protocol evidence.
- Unknown tools, missing results, malformed arguments, and invalid provider
  turn counts still fail. Native invocation tests reject reintroducing the
  turn-count flag; tool-free judge limits remain checked.
- A real native conversation reads four synthetic records through MCP and
  returns the correct route-to-time associations in every trial.
- Full qualification and publication gates pass before issue closure.

## Reassessment Criteria

Reassess if measured application cost or repeated-call failures justify a
separate execution control. Any future protection against excess effects must
be enforced before tool dispatch, with explicit public guarantees.
