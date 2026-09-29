# Problem 016: Feedback deadline test flakes under qualification load

**Status**: Open
**Reported**: 2026-09-29
**Priority**: 12 (High) — Impact: 3 × Likelihood: 4 — an observed false negative blocks exact-commit qualification and release work under normal test-runner load
**Origin**: internal
**Effort**: S
**JTBD**: JTBD-101
**Persona**: framework-maintainer

## Description

The feedback deadline test in `packages/feedback/test/deadlines.test.mjs`
intermittently fails exact-commit qualification even though the four deadline
paths and the production deadline implementation are correct. Its shared test
context allows only 25 milliseconds from context construction to timeout.
Under full-suite load, or occasionally during repeated focused runs, scheduler
delay can consume that entire fixture budget before the adapter has installed
its abort listener.

This creates a false release failure for maintainers trying to qualify an exact
commit before publication.

## Symptoms

- `npm run push:qualify` intermittently fails the test named `provider,
  PostgreSQL, and Firestore waits stop at the feedback deadline`.
- Repeating the focused test reproduced `TimeoutError: The operation was
  aborted due to timeout` after 198 otherwise successful iterations.
- The same adapters passed a 400-iteration direct assertion loop, isolating the
  failure to the test fixture's scheduling margin rather than runtime behavior.

## Workaround

Rerun qualification. A passing rerun does not remove the underlying false
negative or provide a reliable release gate.

## Impact Assessment

- **Who is affected**: Framework maintainers qualifying releases.
- **Frequency**: Intermittent under full-suite or repeated-run load.
- **Severity**: High — it blocks the required exact-commit release gate without
  identifying a product defect.
- **Analytics**: One focused failure after 198 iterations; multiple full-suite
  qualification failures observed on 2026-09-29.

## Root Cause Analysis

The test fixture uses `Date.now() + 25` as a shared deadline. That duration is
too close to ordinary test-runner scheduling variance, so the deadline can
expire before each backend has completed the setup needed to observe the
abort. Production behavior is not implicated.

### Investigation Tasks

- [x] Reproduce the failure under repeated focused execution.
- [x] Compare focused test behavior with direct per-adapter assertions.
- [ ] Give the test fixture scheduling margin while retaining all four deadline
  assertions.
- [ ] Pass repeated focused execution and exact-commit qualification.

## Dependencies

- **Blocks**: P007 release qualification.
- **Blocked by**: (none)
- **Composes with**: R016, qualification false negatives block safe releases.

## Related

- [JTBD-101: Publish Installable Packages Safely](../../jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md)
- Hang-off review found that P001, P003, and P014 share only the JTBD-101
  outcome; none covers feedback deadline scheduling or this test fixture.
- Captured via `/wr-itil:capture-problem` while working P007.
