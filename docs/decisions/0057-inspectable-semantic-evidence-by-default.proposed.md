---
status: "proposed"
date: 2026-09-07
human-oversight: confirmed
oversight-date: 2026-09-07
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-07
supersedes: ["ADR-0055"]
---

# Inspectable Semantic Evidence by Default

> Captured via `/wr-architect:capture-adr`. Tom Howard confirmed the substance
> in this task before implementation.

## Context and Problem Statement

ADR-0055 retained hash-only semantic evidence. Repeated release failures proved
the expected tool calls and a rejected meaning judgment, but omitted the model
response and judge reason needed to determine whether the response or judge was
wrong. The testing framework must make failures easy to examine and diagnose.

## Decision Drivers

- Make a failed semantic test understandable from its saved evidence.
- Preserve the provider-native journey without coaching the answer model.
- Keep credentials and provider configuration out of retained artifacts.
- Reuse the existing evidence structure without another reporting framework.
- Keep independent judgments and expose disagreement instead of retrying it.

## Considered Options

1. **Inspectable evidence by default (chosen)**: retain readable test
   conversations, model-visible tool exchanges, expectations, and judge reasons.
2. **Opt-in transcripts**: keep hashes by default and require a second run or
   configuration flag to collect diagnostic content.
3. **Hash-only evidence**: retain the existing privacy boundary and diagnose
   failures through local reproduction.

## Decision Outcome

Chosen option: **"Inspectable evidence by default"**, because a semantic test
report that hides the response and reason cannot reliably explain its own
failure.

Raw fields are added to the existing answer-turn and judgment records. Evidence
retains user prompts, final assistant responses, public tool names and
arguments, model-visible tool-result content, expected meanings, and judge
reasons. Existing hashes remain for integrity and comparison.

Evidence never retains raw provider events, MCP addresses, configuration,
headers, credentials, environment values, stderr, or home-directory paths.
Semantic tests must use synthetic, non-sensitive, effect-safe fixtures because
their test content is readable in evidence by default.

Every configured independent judgment runs and is recorded before a meaning
assertion fails. A rejected judgment is not retried or replaced. A failed or
malformed judge invocation records a bounded categorical error without raw
stderr or other provider details.

## Consequences

### Good

- A failed artifact shows what the model said and why each judge accepted or
  rejected it.
- Maintainers can distinguish answer failures, judge disagreement, and tool
  contract failures without reproducing the run.
- The existing evidence JSON remains the only report format.

### Neutral

- Local evidence remains mode `0600`.
- Release CI retains example evidence for 14 days as before.
- Native tool selection, three answer trials, and three judgments per meaning
  assertion remain unchanged.

### Bad

- Evidence files are larger.
- Test authors can expose sensitive fixture content if they ignore the
  non-sensitive-fixture requirement before uploading an artifact.
- Failed meaning checks run all configured judgments, increasing the cost of a
  failed test in exchange for complete diagnostic evidence.

## Confirmation

- Evidence contains readable prompts, assistant responses, public tool calls,
  model-visible tool results, expected meanings, and judge reasons.
- A rejected meaning check records all nine configured verdicts before failing.
- Tests prove provider and server credential sentinels do not appear anywhere
  in saved evidence.
- Tests prove raw provider events, MCP configuration, headers, environment,
  stderr, and filesystem paths are absent.
- Public API guidance warns that evidence contains raw test content and requires
  synthetic, non-sensitive fixtures before upload.
- Exact-commit release CI uploads the readable evidence with 14-day retention.

## Pros and Cons of the Options

### Inspectable Evidence by Default

- Good: A single failed run contains the evidence needed for diagnosis.
- Bad: Authors must treat test conversations as publishable artifact content.

### Opt-In Transcripts

- Good: Raw content is retained only when deliberately requested.
- Bad: The first failure remains opaque and a rerun may produce different model
  behavior.

### Hash-Only Evidence

- Good: Minimizes retained content.
- Bad: Proves integrity without explaining semantic failure.

## Reassessment Criteria

Reassess if artifacts expose credential or environment sentinels, if a provider
offers a secure native diagnostic format with the same evidence, or if full
failed-run judgments make semantic qualification unaffordable.
