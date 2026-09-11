# Problem 002: Release Readiness Verifier Only Tests Fixture-Like Stable PASS Marker

**Status**: Open
**Reported**: 2026-09-11
**Priority**: 16 (High) — Impact: 4 × Likelihood: 4 — derived at capture from the observed release-blocking failure and narrow contract coverage
**Origin**: internal
**Effort**: S — focused script and fixture coverage should cover the release-marker contract
**JTBD**: JTBD-101
**Persona**: framework-maintainer

## Description

The release-readiness verifier depends on the exact marker `- Result: PASS`,
but its regression coverage did not protect the live readiness record contract.
During the 2026-09-11 release, a wording-only accessibility edit changed the
stable marker in `docs/reviews/current-release-readiness.md` to
`- Review result: PASS`. Release run `34550575202` then failed at "Prepare
package evidence". The marker was restored and documented in
`docs/briefing/releases-and-ci.md`, and the later exact-commit release completed
at `9bf599a` in workflow run `34552756999`. The permanent control is still
missing: tests should fail when the live readiness file drifts from the marker
contract, not only when a fixture-shaped record changes.

## Symptoms

(deferred to investigation)

## Workaround

(deferred to investigation)

## Impact Assessment

- **Who is affected**: (deferred to investigation)
- **Frequency**: (deferred to investigation)
- **Severity**: (deferred to investigation)
- **Analytics**: (deferred to investigation)

## Root Cause Analysis

### Investigation Tasks

- [ ] Add the smallest regression check that exercises the live release-readiness marker contract.
- [ ] Keep the public review wording clear without changing the verifier's stable machine-readable marker.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- ADR-0023, Mandatory Cognitive-Accessibility Review for Published Content.
- `scripts/verify-release-readiness.mjs` currently requires the exact `- Result: PASS` marker.
- `docs/briefing/releases-and-ci.md` now records the release lesson.
- Captured via `/wr-itil:capture-problem`; no existing ticket matched the title-only duplicate check and no hang-off candidate existed.
