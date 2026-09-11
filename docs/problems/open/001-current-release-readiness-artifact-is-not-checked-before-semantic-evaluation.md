# Problem 001: Current release-readiness artifact is not checked before semantic evaluation

**Status**: Open
**Reported**: 2026-09-11
**Priority**: 15 (High) - Impact: Moderate (3) x Likelihood: Almost certain (5)
**Effort**: S
**WSJF**: 15.0
**Origin**: internal

## Description

The documentation unit test exercises synthetic release-readiness text, but it
does not run the release verifier against the current readiness artifact. A
real release can therefore pass the local documentation test and the expensive
semantic evaluation before `scripts/verify-release-readiness.mjs` rejects the
current file's exact marker format during package-evidence preparation.

Commit `432eba0` corrected the observed marker from `- Review result: PASS` to
the required `- Result: PASS`. The remaining problem is that the current file
and the release workflow's exact verifier contract are still not exercised
early enough to prevent the same class of late failure.

## Symptoms

- `tests/docs/release-readiness.test.mjs` passes against synthetic review text.
- The release workflow can fail later when the current readiness file does not
  contain the verifier's exact literal markers.
- The failure occurs after semantic evaluation has already consumed time and
  provider capacity.

## Workaround

Before starting a release, run `scripts/verify-release-readiness.mjs` against
the current readiness artifact and the exact publication inventory.

## Impact Assessment

- **Who is affected**: Framework maintainers publishing npm packages.
- **Frequency**: Every release with a readiness-file marker that differs from
  the verifier's literal contract.
- **Severity**: Moderate because release preparation and update delivery are
  disrupted, but no incorrect package is published.
- **Analytics**: Release workflow `34550575202` failed at package-evidence
  preparation after the semantic gate.

## Root Cause Analysis

### Preliminary Evidence

The unit test imports the verifier but supplies only inline fixtures. The
release workflow invokes the same verifier later against the selected current
readiness file. The precise earliest reliable test or workflow gate remains to
be confirmed.

### Investigation Tasks

- [ ] Confirm the earliest cheap gate that has the exact publication inventory.
- [ ] Add a reproduction test that uses the current readiness artifact.
- [ ] Create an INVEST story for the permanent fix.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- [Release-readiness verifier](../../../scripts/verify-release-readiness.mjs)
- [Release-readiness tests](../../../tests/docs/release-readiness.test.mjs)
- [Publish installable packages safely](../../jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md)
