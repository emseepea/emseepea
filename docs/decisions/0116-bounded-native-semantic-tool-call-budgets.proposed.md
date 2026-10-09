---
status: "proposed"
date: 2026-10-09
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2027-01-09
---

# Bounded Native Semantic Tool-Call Budgets

Draft for Tom Howard's review. This decision has not been ratified and does
not authorize implementation of issue #150. The proposed public API and
limits below are the terms being presented for ratification.

## Context and Problem Statement

[Issue #150](https://github.com/emseepea/emseepea/issues/150) demonstrates that
native semantic parsers reject a fourth tool call. Legitimate application
journeys may need several bounded reads or a validation retry within one
learner-facing answer. A failed trial needs enough saved evidence to explain
whether its extra calls were legitimate or an application error.

[ADR-0057](0057-inspectable-semantic-evidence-by-default.proposed.md) retains
inspectable, synthetic test conversations and the provider-native journey.
It inherits the three-call execution boundary from earlier decisions. This
proposal changes that call budget and completes failure evidence without
introducing scripted model actions or weakening application assertions.

The existing MCP server developer's JTBD-003 covers proving an AI understands
results. JTBD-101 covers safe qualification and publication. This decision
introduces no new job or persona.

## Decision Drivers

- Permit explicitly bounded application journeys with more than three calls.
- Preserve the current default and provider-native selection of tools.
- Keep independent time, token, provider-turn, and trial limits effective.
- Diagnose the original failed trial without another semantic run.
- Keep credentials and provider configuration out of evidence.

## Considered Options

1. **Explicit per-turn budget with a finite ceiling (proposed)**: configure a
   bounded call allowance and retain privacy-safe failure evidence.
2. **Increase the default globally**: admit longer journeys for every adopter,
   with increased cost and no explicit application decision.
3. **Keep three calls**: require adopters to restructure their scenarios,
   even where real users need a legitimate multi-call answer.

## Decision Outcome

Chosen option: **"Explicit per-turn budget with a finite ceiling"**, subject to human
ratification of all terms below. Supplement ADR-0057's inherited call limit;
its native journey, evidence, independent judgments, and no-retry policy
remain applicable.

### Public configuration

Add optional `maxToolCalls` to `ConversationOptions` used by
`createConversation`. Accept only finite integers from **1 through 32**;
reject invalid values before starting a server or provider. Omission means
**3**. No global environment override or per-send override is introduced.

The allowance applies independently to each `send` in every answer trial.
`fresh()` starts a new conversation with the same configured allowance.
An attempted MCP call counts once, including a failed call or repeated call.
A validation retry consumes the same allowance; it does not grant an extra
call. Existing advertised-tool, target-server, and application assertions
remain enforced.

The ceiling of 32 is a proposed cost and evidence bound, not an assertion that
all providers can complete 32 sequential calls. Raising it later requires
reassessment.

### Provider turns remain a separate limit

A learner-facing `send`, a provider execution round, and an individual MCP
call are different units. Several calls may occur in one provider round.
The budget must count calls, while provider-round validation must use the
provider's actual native evidence rather than assume one round per call.

Claude currently launches with `--max-turns 4`. That independent setting
remains unchanged. A larger call allowance does not guarantee that a longer
sequential workflow will fit. Four calls batched within the allowed native
rounds may pass; four sequential calls requiring five rounds still fail.
Codex retains its existing independent execution controls.

If a provider cannot supply adequate native round evidence, fail explicitly
rather than manufacture a successful count. Parser tests are not evidence
that a live provider completed the journey.

### Qualification limit, not a rollback guarantee

Apply the same call-budget validation to native Claude and Codex evidence.
A turn exceeding its budget fails qualification and cannot supply a passing
answer or assertion result. Unknown or unrelated tools still fail even when
the budget is larger.

Native event parsers may discover excess calls after the provider executed
them. This budget is not a transactional rollback or a guaranteed hard cap
on backend effects. Stop further work when excess calls can be detected, but
do not claim already executed effects were prevented or undone. Tests must
continue using synthetic, non-sensitive, effect-safe fixtures.

No budget failure triggers a semantic retry. Existing timeouts, cancellation,
token limits, provider limits, three answer trials, independent meaning
judgments, and application acceptance assertions remain effective.

### Bounded failure evidence

Extend the existing evidence JSON rather than create a second reporting
pipeline. Successful and failed turns record the configured budget and
observed attempted-call count. Failure reasons distinguish exhausted budgets,
forbidden tools, invalid arguments, missing results, provider limits,
authentication, cancellation, timeout, and incomplete execution.

Retain ordered attempted calls to advertised tools, their checked arguments,
available model-visible results, and categorical validation failures after
secret filtering. An invalid tool name or unvalidated payload must not be
copied into readable evidence; retain a position, category, and hash instead.
Absence of a result must remain distinguishable from a successful result.

Retain at most `maxToolCalls + 1` attempted-call records per failed turn,
with at most 8 KiB of serialized arguments or result content per record and
256 KiB total failed-turn evidence. Counts cover all observed calls even
when retained records are truncated. Explicit truncation markers and hashes
identify omitted content; truncation cannot change failure to success.

Configured secrets, authentication tokens, MCP endpoint addresses, provider
configuration, headers, environment values, raw provider events, stderr,
and home-directory paths remain excluded. Keep the existing private local
file permissions and CI artifact retention. Ordinary test prompts and fixture
content remain readable under ADR-0057, so authors must treat them as
publishable synthetic content.

## Consequences

### Good

- Adopters can qualify legitimate multi-call answers within explicit limits.
- Default consumers retain the three-call behavior.
- A failed artifact explains the attempted workflow without rerunning it.

### Neutral

- Provider-round limits may prevent some workflows below the call ceiling.
- Batching depends on actual provider behavior and application tool contracts.
- Evidence limits can omit large fixture payloads with explicit markers.

### Bad

- Larger allowances can increase latency and cost within existing deadlines.
- Native execution can perform excess calls before failure is detected.
- Both provider parsers and failure reporting need coordinated changes.

## Confirmation

Required before release; these are acceptance checks, not passing evidence.

- Types and runtime validation accept 1–32 and reject zero, negatives,
  fractions, non-numbers, infinities, and values above 32 before execution.
- The default rejects a fourth call in both native provider parsers.
- A configured larger budget admits a valid four-call native conversation
  where actual provider rounds fit the unchanged independent limit.
- Unknown tools, wrong servers, invalid calls, missing results, exhausted
  budgets, and provider limits fail with distinct bounded evidence.
- Repeated calls and validation retries consume the allowance; application
  assertions retain their existing exactness and failure behavior.
- Follow-up sends and `fresh()` use the configured allowance independently.
- Credential, endpoint, environment, and provider-event sentinels are absent
  from success and failure evidence, including adversarial invalid payloads.
- Oversized evidence retains counts, hashes, and explicit truncation markers
  without altering the original failed outcome.
- Native batching and provider-round validation are checked with real
  provider evidence; synthetic parser fixtures are labelled as such.
- Genuine live acceptance evidence is retained for each provider claimed
  supported. An unavailable provider remains incomplete rather than passing.
- Existing Claude scenarios, packed installs, exact-source qualification,
  vulnerability, performance, semantic release, and publication gates pass.

## Reassessment Criteria

Reassess if legitimate workflows need more than 32 calls, provider round
semantics change, artifact bounds prevent diagnosis, secret sentinels leak,
or larger budgets cannot remain within existing cost and execution limits.
