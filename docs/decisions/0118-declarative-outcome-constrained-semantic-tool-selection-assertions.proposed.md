---
status: "proposed"
date: 2026-10-11
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["wr-architect:agent", "wr-jtbd:agent"]
informed: []
reassessment-date: 2027-01-11
---

# Declarative Outcome-Constrained Semantic Tool-Selection Assertions

> Captured via `/wr-architect:capture-adr`. Tom Howard directed the reported
> Coglen qualification gap to be fixed first. The decision remains unconfirmed
> until he ratifies it after successful production-use evidence is available.

## Context and Problem Statement

[Issue #158](https://github.com/emseepea/emseepea/issues/158) reports that a
semantic conversation can pass all meaning judgments and application-state
checks, yet fail during closure when valid data-dependent retrieval or recovery
paths differ across trials. The current assertions accept exact ordered calls,
one of at most eight exact ordered name sequences, or narrowly optional calls.

Copying the observed calls into the expected calls would make the test
self-fulfilling. Listing every possible exact sequence is not a stable
application contract. The framework needs an independently authored,
serializable way to assert the permitted outcome of a completed native tool
selection without imposing another execution ceiling.

## Decision Drivers

- Qualify data-dependent native MCP journeys without treating observed calls
  as their own expectation.
- Keep tool selection fail-closed and independently revalidatable from saved
  evidence.
- Preserve exact assertions for deterministic order and count journeys.
- Keep argument, result, persisted-effect, and response-meaning assertions
  separate from the selection envelope.
- Preserve three fresh trials, all judgments, redaction, cancellation, and no
  semantic retries.

## Considered Options

1. **Declarative closed-world selection contracts (chosen)**: assert required,
   optional-allowed, and forbidden tools plus per-tool and total cardinalities.
2. **Enumerate exact sequences**: continue listing every permitted order and
   recovery path.
3. **Accept the calls that happened**: record actual calls as their own
   expectation.

## Decision Outcome

Chosen option: **"Declarative closed-world selection contracts"**, because it
states the application's permitted outcome independently of the model's
observed path and can be checked again from retained evidence.

Add an outcome-constrained tool-selection assertion for a completed semantic
conversation turn. Its contract contains disjoint required and
optional-allowed tool entries with finite minimum and maximum call counts, an
optional explicit forbidden list, and finite minimum and maximum totals. The
required and optional-allowed union is the complete permitted world. Every
advertised tool omitted from that union is forbidden even when it is not
listed explicitly.

"Closed-world" means the contract names every tool the turn may use; any
advertised tool outside the contract is treated as forbidden.

Every named tool must have been advertised to the model. Empty, overlapping,
conflicting, non-canonical, or impossible contracts fail before they can
qualify a turn. The assertion evaluates all completed calls. A configured
maximum count is checked only after the turn completes. It does not stop
dispatch, truncate evidence, or replace ADR-0116.

Evidence retains the normalized canonical contract, its SHA-256 digest, the
advertised tool names, and the concrete native calls already captured under
ADR-0057. It does not retain private tool schemas for this assertion. Evidence
validation re-normalizes the retained contract, verifies the digest, confirms
that every contract name was advertised, and independently evaluates every
retained call. Missing, mutated, non-canonical, digest-mismatched, or
unsatisfied contracts fail. A stored pass boolean or callback result is not
sufficient evidence.

### Evidence Boundary

This assertion proves only that completed native calls satisfy the declared
selection envelope. It makes no ordering claim. Existing exact assertions
remain the right choice when order and exact count matter. Argument checks,
tool-result checks, persisted-effect checks, and response-meaning judgments
remain separate assertions authored independently of the observed selection.

## Consequences

### Good

- Valid retrieval and recovery sequences may differ without weakening the
  declared application outcome.
- Saved evidence contains enough information for independent revalidation.
- The contract cannot become true merely because the model made those calls.

### Neutral

- Existing exact assertions and evidence remain compatible.
- Test authors still assert arguments, results, effects, and meaning separately.

### Bad

- Closed-world cardinality contracts require more care than one exact sequence.
- A broad allowed set can prove less than an exact order, so guidance must make
  that evidence boundary explicit.

## Confirmation

- Three trials with different valid retrieval orders and recovery calls pass
  one independently authored selection contract.
- Unadvertised, omitted, explicitly forbidden, duplicated, and over-cardinality
  tools fail, as do impossible or conflicting contracts.
- Tampered contracts, digests, concrete calls, results, or path evidence fail
  independent evidence validation.
- The synthetic fixture separately asserts required arguments, results,
  persisted effects, and meaning. Missing or mismatched values fail their
  assertions.
- Existing exact assertion tests and published evidence remain compatible.
- An independently installed package qualifies the synthetic reproduction for
  issue #158 before the decision is eligible for confirmation.

## Reassessment Criteria

Reassess if real tests need ordering constraints inside the declarative
contract, if cardinality rules cannot express a legitimate outcome, or if the
contract is mistaken for proof of arguments, results, effects, or meaning.
