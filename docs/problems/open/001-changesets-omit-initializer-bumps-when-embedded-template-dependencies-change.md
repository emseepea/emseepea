# Problem 001: Changesets Omit Initializer Bumps When Embedded Template Dependencies Change

**Status**: Open
**Reported**: 2026-09-11
**Priority**: 20 (Very High) — Impact: 4 × Likelihood: 5 — derived at capture from the observed release failure and absent automatic change-detection control
**Origin**: internal
**Effort**: M — release detection and focused regression coverage span a few files
**JTBD**: JTBD-101
**Persona**: framework-maintainer

## Description

Changesets can update core public package versions without bumping maintained
initializer packages whose generated templates embed those versions. During the
2026-09-11 release, core packages reached `0.7.0` while generated initializer
templates still referenced `0.6.1`; the registry quickstart failed with
`'0.6.1' !== '0.7.0'`. Commit `79efc97` added explicit patch changesets for the
affected initializers, and the later exact-commit release completed at
`9bf599a` in workflow run `34552756999`. That correction published the affected
versions but did not add a permanent release/change-detection control.

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

- [ ] Identify the narrowest release check that detects changed embedded public-package versions without corresponding initializer bumps.
- [ ] Create a reproduction test covering every maintained initializer in the canonical public-package list.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- ADR-0042, Separate Example Initializer Packages.
- ADR-0071, Separate OpenAPI-Backed Example and Initializer.
- Captured via `/wr-itil:capture-problem`; no existing ticket matched the title-only duplicate check and no hang-off candidate existed.
