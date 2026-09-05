---
status: "proposed"
date: 2026-09-06
human-oversight: confirmed
oversight-date: 2026-09-06
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-06
supersedes: ["ADR-0040"]
---

# Conversation-Style Semantic Tests

## Context and Problem Statement

Em See Pea's semantic tests currently combine the question, required text,
meaning criteria, and expected tool names in one configuration object. They
hide the sequence of user and assistant turns, make tool-call expectations hard
to read, and cannot express a follow-up turn that should use conversation
history without calling another tool.

Tests should read like ordinary JavaScript: create a conversation, send a user
prompt, and assert what the model called and what its response meant. This must
retain the existing isolation, bounded execution, evidence, and release gates.

## Decision Drivers

- Make each test's user interaction and expected behaviour obvious to readers.
- Support several prompts in one isolated conversation.
- Assert exact tool names, arguments, order, count, and absence without parsing
  prose.
- Keep literal response checks separate from model-judged meaning checks.
- Preserve safe provider isolation and official-client MCP execution.
- Avoid adding a test runner, evaluation framework, or numerical text parser.

## Considered Options

1. **Conversation-style JavaScript tests**: expose a small conversation and
   assertion API backed by Node assertions and the existing Em See Pea model
   runner and judge.
2. **Keep configuration-object tests**: retain `toolSelectionTest`,
   `semanticTest`, `criticalFacts`, and one question per test.
3. **Adopt a third-party evaluation framework**: replace or wrap the current
   runner with Promptfoo or another evaluation framework.

## Decision Outcome

Chosen option: **"Conversation-style JavaScript tests"**, because it makes the
test's behaviour readable while reusing the qualified implementation already
in `@emseepea/testing`.

Tests use Node's test runner. `createConversation` starts one isolated logical
conversation per trial. Its optional context is absent by default and, when
provided, represents the application context under test rather than hidden test
guidance. Each `send` call records the model-selected call plan, executes valid
calls through the instrumented official MCP client, supplies their results to
the answering model, and preserves the resulting answer and material for the
next turn in that same trial.

Thin Em See Pea assertions make domain expectations readable:

- `assertToolCalls` checks the exact ordered tool names and arguments and
  therefore also checks the call count.
- `assertNoToolCalls` checks that a turn selected and executed no tools.
- `assertResponseContains` accepts literal strings only and performs no numeric
  interpretation or normalization.
- `assertResponseMeaning` asks the existing isolated judge whether the response
  satisfies an explicit expected meaning.

The deterministic assertions use `node:assert/strict`. The meaning assertion
reuses the existing model command, strict judge-verdict parser, isolation, and
evidence format. Em See Pea does not add Promptfoo, another test runner, or a
natural-language number parser.

Zero calls are valid for a turn whose answer should come from the established
conversation, such as a follow-up question. Initial turns may also expect zero
calls when the behaviour under test is that no advertised tool is appropriate.
The configured expected calls determine the permitted count, subject to the
existing bounded-call limit.

Selection remains a provider-neutral, validated call plan. It demonstrates
which calls the model selected for the advertised contracts and the user
conversation, not provider-native autonomous MCP execution. Only the harness
can reach the loopback server. The model receives no server URL, server token,
shell, filesystem, browser, arbitrary network, or native MCP access.

Each answer trial has its own conversation history. Follow-up prompts are bound
only to the actual prior prompts, answers, selected calls, and MCP material from
that trial. The selection, answer, and judgment processes remain isolated,
cancellable, bounded, and free of semantic retries.

Evidence continues to hash advertised contracts, selected calls, MCP requests
and responses, source cases, and judgments without retaining raw private
material, model answers, credentials, or assertion details. Maintained examples
and their generated initializer projects use the conversation API and retain
ordinary tests, semantic smoke qualification, exact-commit live evaluation, and
registry verification.

## Consequences

### Good

- Tests read in the same order as the conversation they specify.
- Exact calls and no-call behaviour are visible without inspecting traces.
- Follow-up behaviour can be tested against actual history from the same trial.
- Existing provider, judge, and MCP-client code remains the implementation
  foundation.

### Neutral

- The public testing API changes and requires a Changesets release.
- Model selection is still represented by a validated provider-neutral plan.
- Literal response assertions are intentionally strict; semantic alternatives
  belong in meaning assertions.

### Bad

- Existing semantic tests must be migrated.
- Multi-turn trials can make more model requests than single-turn trials.
- Model-judged meaning remains probabilistic and therefore retains repeated
  independent judgments.

## Confirmation

- Public types and deterministic tests cover context omission, sequential
  prompts, isolated histories, exact calls, arguments, order, count, and no-call
  turns.
- Tool calls execute only through the instrumented official MCP client after
  validation against advertised contracts.
- Literal containment tests reject non-string expectations and do not normalize
  numbers.
- Meaning assertions use the existing strict judge verdict and retain three
  independent judgments per answer.
- Provider processes receive no server URL, server credential, or extra tool
  access, and cancellation stops every stage.
- Evidence binds each prompt, selection, MCP operation, answer, and judgment to
  its trial without retaining raw private content.
- Every maintained example has readable conversation-style semantic tests.
- Every packed initializer passes its semantic smoke check outside the
  monorepo.
- The exact publishing commit passes the live semantic job and all existing
  release gates before registry publication.

## Pros and Cons of the Options

### Conversation-Style JavaScript Tests

- Good: Makes the intended interaction and assertions directly readable.
- Good: Reuses the current runner, judge, evidence, and Node test stack.
- Bad: Requires a public API migration and careful multi-turn evidence handling.

### Keep Configuration-Object Tests

- Good: Requires no implementation or migration.
- Bad: Keeps mechanics and domain meaning mixed in large configuration objects.
- Bad: Cannot clearly express a follow-up turn that should make no new call.

### Adopt a Third-Party Evaluation Framework

- Good: Provides a broad catalogue of generic evaluation metrics.
- Bad: Duplicates existing qualified capabilities and substantially expands the
  dependency and configuration surface.

## Reassessment Criteria

Reassess if provider-neutral call plans materially diverge from deployed MCP
clients, the bounded call limit blocks an accepted use case, or the existing
judge cannot express a required response-quality assertion.
