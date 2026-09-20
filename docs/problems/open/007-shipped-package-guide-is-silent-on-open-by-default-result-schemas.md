# Problem 007: The Shipped Package Guide Is Silent on Open-by-Default Result Schemas

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 12 (High) — Impact: 3 × Likelihood: 4 — see the rating note below
**Effort**: S (small) — a section in one guide, plus its review evidence
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

This is the gap JTBD-102 names: when the framework's behaviour changes, the
published guidance should be checked against that same change. The job is
ratified; the check it describes does not exist as an automated control.

### Investigation Tasks

- [ ] Create reproduction test
- [ ] Add the open-by-default default and the closed-contract declaration to the
      package guide
- [ ] Decide whether a release can be gated on guidance being checked against
      the behaviour it documents, and what that check could mechanically assert

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

Arises from ADR-0096, which publishes result schemas open by default. Sibling of
P006, which records a correctness defect from the same decision; this ticket
records a guidance defect from it.

Captured via /wr-itil:capture-problem; expand at next investigation.
