# Current Release Readiness

Date: 2026-11-10

## Paged Firestore feedback conversations

Status: **PREPARED**. Publication is pending.

The release adds opt-in Firestore feedback tools that keep serialized MCP
results within the configured byte limit. A continuation cursor lets callers
read later messages in the same thread. The default feedback tools retain
their existing schemas and result format.

## Planned package

- `@emseepea/feedback@0.13.0`

## Qualification

The implementation commit passed clean-install qualification and the Linux
benchmark. The adapter tests cover full-text pagination, cross-scope and
cross-thread cursor denial, and oversized results. Local packed-package tests
used MCP `2025-06-18` and `2026-07-28` with synthetic Firestore data. They
read through message 201, preserved the default tool contract, and confirmed
that the tool records an offer only for team replies it includes in the
returned page.

Architecture, behavioural test, voice and cognitive reviews covered the
implementation and adopter guide. The exact source Quality run, release
candidate qualification, publication, registry readback, independent package
installation and mergeback Quality are separate checks.

The previous package release has a
[release-time readiness record](https://github.com/emseepea/emseepea/blob/e1d1688dcbb9953d5436e22d570900e33b30ba90/docs/reviews/current-release-readiness.md).

The verdicts below apply to preparation.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
