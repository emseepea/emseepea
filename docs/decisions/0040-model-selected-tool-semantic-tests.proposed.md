---
status: "proposed"
date: 2026-09-01
human-oversight: confirmed
oversight-date: 2026-09-01
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-01
supersedes: ["ADR-0029"]
---

# Model-Selected Tool Semantic Tests

## Context and Problem Statement

Em See Pea's code-first semantic tests prove that a language model can explain
material returned by an MCP server. Test code currently chooses every MCP
operation first. A passing test therefore does not prove that the model can
choose the correct tool or arguments for a user's question.

We need to test tool selection without giving the model shell, filesystem,
browser, arbitrary network, unrelated MCP, or credential access. We must also
retain the existing interpretation checks for resources, prompts, and tests
that deliberately prepare several related results.

## Decision Drivers

- Test both correct tool selection and correct interpretation of its result.
- Use each server's advertised public tool contract as the source of choices.
- Keep provider access isolated from the server and its credentials.
- Bound calls, turns, model cost, retained evidence, and failure modes.
- Preserve ordinary JavaScript tests and the example-owned `eval/` layout.
- Keep the public testing package small and provider-independent.

## Considered Options

1. **Validated model-selected call plans** - Give a tool-free model the user's
   question and advertised tool contracts. Validate its strict JSON call plan,
   execute it through the instrumented official MCP client, then ask a separate
   tool-free model turn to answer only from those results.
2. **Direct provider MCP access** - Configure the model CLI with the loopback MCP
   server and allow it to invoke tools directly.
3. **Keep harness-selected calls only** - Continue testing interpretation but
   make no tool-selection claim.
4. **Leave selection to application journey tests** - Keep the public package
   unchanged and require every adopter to build its own selection harness.

## Decision Outcome

Chosen option: **"Validated model-selected call plans"**, because it tests the
model's choice while keeping execution, validation, credentials, cancellation,
and evidence under one deterministic harness.

`@emseepea/testing/semantic` exposes two helpers:

- `toolSelectionTest` for questions that should cause the model to choose and
  call MCP tools;
- `semanticTest` for interpretation tests whose MCP operations are deliberately
  prepared by test code, including resource and prompt cases.

For each `toolSelectionTest` trial, the harness starts the server and calls
`tools/list` through the official MCP client. The selection model receives only
the question plus the advertised tool names, descriptions, and public input
schemas. It returns one strict JSON object containing between one and three
tool calls. The harness rejects malformed JSON, unknown tools, non-object
arguments, too many calls, missing expected tools, or unexpected tools.

The harness executes the accepted calls through the same instrumented official
MCP client used by existing semantic tests. A separate tool-free model turn
answers the question only from the bound MCP results. Judges remain tool-free.
The selection, answer, and judgment stages use fresh isolated directories and
permit no semantic retries.

The model never receives the server URL, authentication token, provider token,
shell, filesystem, browser, arbitrary network access, or native MCP access.
Only the harness can reach the named loopback server. Provider credentials
still reach only the isolated model process and never the example server.

Evidence records hashes of the advertised tools, selected calls, actual MCP
requests and responses, the selected and expected tool names, and each model's
turn count. Raw server data, model answers, credentials, and private assertion
details remain excluded.

All tool-based examples use `toolSelectionTest`. The resources-and-prompts
example remains on `semanticTest` because it tests interpretation of an explicit
resource read and prompt request. Ordinary tests and `eval/` remain separate.

This supersedes ADR-0029. Its code-first format, three answer trials, three
judgments per answer, provider isolation, evidence retention, public package,
Changesets release process, and copied-example quality requirements remain.
The owner explicitly directed this change and the example migration on
2026-09-01 after confirming the current tool-selection limitation.

## Consequences

### Good

- Tool examples fail when the model chooses no tool, the wrong tool, unsafe
  arguments, or an unnecessary extra tool.
- The same trial then proves whether the model understands the chosen result.
- Tool execution remains observable, validated, cancellable, and reproducible.
- Resource and prompt interpretation tests do not acquire artificial tool logic.

### Neutral

- Tool-selection trials require one additional model response per trial.
- The call plan is provider-neutral JSON rather than a provider-specific native
  tool protocol.

### Bad

- A call-plan test does not reproduce every provider's native agent loop.
- The public semantic-test API and release evidence gain another versioned mode.
- More model responses increase semantic-check time and subscription usage.

## Confirmation

- Deterministic tests accept correct advertised selections and reject missing,
  unknown, extra, malformed, and over-limit selections.
- Arguments must be objects and are checked again by the real MCP server.
- Selected calls are executed only through the instrumented official MCP client.
- Protected-tool tests prove the server receives its test token while model
  processes receive neither that token nor provider credentials they do not own.
- Cancellation stops selection, MCP execution, answer, and judgment work.
- Evidence records selection and operation hashes without raw private material.
- Every tool-based example uses `toolSelectionTest`; the resource/prompt example
  retains `semanticTest`.
- Copied examples pass lint, ordinary tests, and semantic smoke checks using
  packed public packages.
- The exact publishing revision passes all real-model semantic cases before npm
  publication.

## Pros and Cons of the Options

### Validated Model-Selected Call Plans

- Good: Tests the missing decision while retaining the existing safety boundary.
- Bad: Simulates the provider's tool protocol with a strict public call plan.

### Direct Provider MCP Access

- Good: Closest to a provider's complete agent journey.
- Bad: Provider policy and ambient configuration can block, contaminate, or
  broaden the test beyond the named server.

### Keep Harness-Selected Calls Only

- Good: Small, stable, and already implemented.
- Bad: Cannot detect incorrect tool choice.

### Leave Selection to Application Journey Tests

- Good: Lets each adopter match its deployed client exactly.
- Bad: Leaves Em See Pea's defining testing package incomplete and duplicates
  security-sensitive orchestration.

## Reassessment Criteria

Reassess if a provider-neutral agent protocol can expose exactly one loopback
MCP server with equivalent isolation and evidence, more than three calls is
needed by an accepted use case, or call-plan tests diverge materially from
deployed-client tool selection.
