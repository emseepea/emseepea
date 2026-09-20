# Problem 008: The Release Package List Is Transcribed by Hand Into the Readiness Record

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 12 (High) — Impact: 3 × Likelihood: 4 — the release stops before anything is published, so the cost is a wasted cycle rather than a bad publication; the list must be retyped on every release, so drift is likely
**Origin**: internal
**Effort**: M (medium) — deriving the list is small work, but deciding what the record asserts is a design question that touches the record's shape and the checks that read it
**Jobs To Be Done (JTBD)**: JTBD-101 — a job to be done: publish installable packages safely
**Persona**: framework-maintainer

## Description

The list of packages being published is typed by hand into
`docs/reviews/current-release-readiness.md`.
`scripts/verify-release-readiness.mjs` then parses that list back out of the
prose and compares it with the set of packages the run is about to publish. The
comparison runs both ways: no package in the record that is not being published,
and none being published that is not in the record. The same assertion is reused
against the assembled Changesets plan when the check runs on a release pull
request.

This stopped the 0.15.0 release on 2026-09-19. The record still named the
previous release's twelve packages while sixteen were being published. The gate
compares lists, so its failure says nothing about the sixteen packages
themselves. The record was stale, not the release.

Be careful about what that means. The check was right: the record genuinely did
not match. The problem is that the record copies something the tooling already
holds. Keeping the copy correct is manual work that adds no information, and
getting it wrong costs a release cycle.

There are two separable problems here, and a fix that takes only the first would
leave the more important one in place.

**The list is copied rather than derived.** The release run captures the set it
is about to publish into `release-artifacts/registry-before.json`, and
`readPlannedReleaseStatus` holds the assembled Changesets plan for the pull
request path. Either way the machine already has the list. The transcription
adds no information the tooling does not already hold. The person writing it
copies the list from one of those sources — that is exactly what the workaround
below instructs.

**The check is shaped like a sign-off it is not.** Comparing a record against a
payload is the shape of an attestation: someone confirming they reviewed this
exact set. On the 2026-09-19 release the same agent wrote the changeset and
wrote the readiness record. The verifier then checked that two artefacts by one
author agreed. That shows a list was copied accurately. It shows nothing about
review. The maintainer's assessment of this, recorded verbatim because the
wording matters: "that is a lie. A human is not writing that file."

So the fix should start by deciding what the record is actually asserting, and
only then decide how to check it. Deriving the list correctly while keeping the
sign-off framing would remove the friction and leave the sign-off claim
untouched. On the maintainer's reading that is the worse of the two outcomes:
the friction is visible, and the claim is not.

## Symptoms

- The release stops at the "Prepare package evidence" step of
  `.github/workflows/release.yml`. `scripts/verify-release-readiness.mjs` fails
  with `release-readiness package set does not match publication` and the
  assertion output lists the package specs that differ.
- Nothing is published and no registry state changes. The cost is the stopped
  release cycle.
- Observed once: 2026-09-19, during the 0.15.0 release. The record named the
  previous release's twelve packages while sixteen were being published.

## Workaround

Before releasing, rewrite the package list in
`docs/reviews/current-release-readiness.md` to match exactly what is about to be
published, including every dependency-driven bump.

## Impact Assessment

- **Who is affected**: maintainers preparing a release.
- **Frequency**: possible on every release, because the record is rewritten each
  time and the list must be retyped to match.
- **Severity**: the release stops before publishing. No registry or package
  state changes, so the cost is a wasted release cycle.
- **Analytics**: one observed occurrence, 2026-09-19, during the 0.15.0 release.

## Root Cause Analysis

### Investigation Tasks

- [ ] Decide what the readiness record is asserting, and whether comparing it
  against the published set can honestly assert it.
- [ ] Derive the package list from the set the run is about to publish rather
  than parsing it back out of prose, or record why the copy is worth keeping.
- [ ] Create a reproduction test.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: Problem 002 (Release Readiness Verifier Only Tests
  Fixture-Like Stable PASS Marker) and Problem 004 (Problem Backlog Parser
  Couples to an Unexplained Exact Heading). All three are the same family — a
  value that tooling must read, kept as prose a person maintains. Neither blocks
  this one, and a decision about whether machine-read values may live as prose
  would bear on all three.

## Related

- `scripts/verify-release-readiness.mjs` — `assertReleaseReadiness` holds the
  set-equality assertions and matches package lines with
  ``/^- `([^`]+@[^`]+)`$/gm``. `readPlannedReleaseStatus` in the same file
  assembles the Changesets plan used on the release pull request path.
- Call sites: `scripts/push-and-watch.mjs`, `scripts/release-and-watch.mjs`, and
  the "Prepare package evidence" step of `.github/workflows/release.yml`, which
  passes `release-artifacts/registry-before.json` as the published set.
- ADR-0023, Mandatory Cognitive-Accessibility Review for Published Content. The
  readiness record lives under `docs/`, and
  `tests/docs/published-content-review.test.mjs` treats changed Markdown there
  as in scope. So one gate asks for clearer prose in that file while another
  requires exact literals in it. No conflict has been hit yet; it is a
  constraint on whatever reshapes the record.
- Problem 004 carried this observation as an inherited follow-up while it had no
  ticket of its own, and listed capturing this ticket as an investigation task.
  Both now point here.
- Captured via `/wr-itil:capture-problem` at the maintainer's direction. The
  title-only duplicate check matched Problems 002, 003 and 007. None is a
  duplicate: 002 and 003 are neighbouring release-gate tickets, and 007 shares
  only the word "package". The arbiter that decides whether new scope should
  hang off an existing ticket was not run, because that question was already
  settled: Problem 004 records that this scope needs its own ticket, and the
  maintainer directed the capture.
