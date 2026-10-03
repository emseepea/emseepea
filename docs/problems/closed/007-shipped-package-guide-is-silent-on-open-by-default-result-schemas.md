# Problem 007: The Shipped Package Guide Is Silent on Open-by-Default Result Schemas

**Status**: Closed (closed-on-evidence 2026-10-01 — the published `@emseepea/server@0.19.1` tarball contains the corrected guide, and the packed-package test passed 7/7 checks. Recovery: rerun /wr-itil:transition-problem 007 known-error to reopen)
**Reported**: 2026-09-20
**Priority**: 12 (High) — Impact: 3 × Likelihood: 4 — see the rating note below
**Origin**: internal
**Effort**: S (small) — a section in one guide, plus its review evidence
**WSJF**: 24.0 — Priority 12 × Known Error multiplier 2.0 / Effort 1
**JTBD**: JTBD-102 — a job to be done: keep guidance accurate
**Persona**: framework-maintainer

## Description

`@emseepea/server@0.15.0` publishes tool result schemas open by default. The
package guide shipped inside that same package does not say so.

The guide documents result schemas at length. It does not state that a result
declared with an ordinary object schema now publishes a contract permitting
unknown fields, and it does not mention the way to ask for a closed contract.
The only prose naming the closed-contract declaration anywhere in the repository
is the release note, which is consumed once and becomes a changelog entry.

An adopter who reads the guide rather than the changelog learns the old
behaviour from a document shipped in the package that has the new one.

## Symptoms

The published package contains a guide describing result schema behaviour that
the same package no longer implements. A reader following it cannot tell that
the default changed, or how to opt back into a closed contract.

## Workaround

Read the changelog entry for 0.15.0, which states the new default, names the
closed-contract declaration, and gives the migration step.

## Rating note

Impact is 3. Guidance that contradicts the package it ships in misleads without
causing a security failure or breaking a running server. The error is toward
under-informing: a reader keeps the old mental model rather than being told to
do something harmful.

Likelihood is 4. The guide is inside the published package and documents exactly
the surface that changed, so a reader looking up result schema behaviour meets
the stale text on the ordinary path rather than an unusual one.

## Impact Assessment

- **Who is affected**: developers reading the package guide to learn how result
  schemas are published.
- **Frequency**: (deferred to investigation)
- **Severity**: see the rating note above.
- **Analytics**: (deferred to investigation)

## Root Cause Analysis

The implementing change touched the framework source, a black-box test, the
release note, and a review record. It did not touch any adopter-facing guide.
Nothing in the release path checks that a behaviour change is reflected in the
guidance shipped alongside it, so the omission reached a published release
without being reported.

The behaviour is already covered by
`tests/black-box/output-schema-openness.test.mjs`. The missing boundary is the
shipped guide: there was no focused check requiring the guide to state the
open-by-default contract, the direct `z.strictObject` closed contract, and the
rule that runtime responses contain only declared fields.

On 2026-09-25, this executable documentation assertion exited 1 because the
guide has no matching section:

```sh
node --input-type=module -e 'import assert from "node:assert/strict"; import { readFile } from "node:fs/promises"; const guide = await readFile("packages/framework/README.md", "utf8"); assert.match(guide, /## Published Result Schemas[\s\S]*z\.object[\s\S]*open[\s\S]*z\.strictObject[\s\S]*closed[\s\S]*declared fields/i);'
```

This is the gap JTBD-102 names: when the framework's behaviour changes, the
published guidance should be checked against that same change. The job is
ratified; the check it describes does not exist as an automated control.

### Investigation Tasks

- [x] Create and run a failing documentation assertion against the shipped guide
- [x] Add the open-by-default default and the closed-contract declaration to the
      package guide
- [x] Define a focused guide check that can mechanically assert the
      open-by-default contract, the direct `z.strictObject` closed contract,
      and the rule that runtime responses contain only declared fields

## Fix Strategy

The completed proposal is STORY-MAP-002, with RFC-002 and STORY-002. It keeps
the package-guide edit, focused documentation test, packed-package inspection,
changeset, and cognitive-accessibility review in one small delivery story.

STORY-MAP-002 is ratified and completed; STORY-002 is done. ADR-0096 governs the
schema behaviour; ADR-0023 governs the published-content review.

**Release vehicle**: .changeset/published-result-schema-guide.md

## Fix Released

The package guide correction entered `@emseepea/server@0.19.0` in version commit
`e75e06ed7636ea8c87a9208c51b00d075fc095ee` and is present in the current
published `@emseepea/server@0.19.1` tarball. The guide now explains the open
`z.object` contract, direct `z.strictObject` closed contract, piped strict
limit, and declared-only runtime responses. The packed-package documentation
test passed 7/7 checks on 2026-10-01, and the published 0.19.1 tarball's
`package/README.md` was inspected directly. This post-release package check
verified the ticket's guide correction.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

Arises from ADR-0096, which publishes result schemas open by default. Sibling of
P006, which records a correctness defect from the same decision; this ticket
records a guidance defect from it.

Captured via /wr-itil:capture-problem; expand at next investigation.
## Story Maps

| ID | Title | Status |
|----|-------|--------|
| STORY-MAP-002 | STORY-MAP-002: Keep the Shipped Package Guide Aligned with Framework Behaviour | completed |


## Stories

| ID | Title | Status |
|----|-------|--------|
| STORY-002 | STORY-002: Explain Open-by-Default Result Schemas in the Package Guide | done |
