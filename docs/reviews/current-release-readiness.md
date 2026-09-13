# Current Release Readiness

Date: 2026-09-13

Release verification is not complete. This increment adds a deterministic,
framework-neutral MCP Apps host simulator to `@emseepea/testing`. It drives the
existing `createMcpAppController` boundary rather than replacing its lifecycle,
message validation, or source validation.

## Planned Release Batch

- `@emseepea/testing@0.10.0`

## Change for Users

MCP Apps authors can exercise initialization, tool results, host-context
changes, successful and rejected `ui/message` requests, cancellation, and
teardown without constructing a fake JSON-RPC dispatcher or choosing a UI
framework or test runner. Trusted arbitrary dispatch and untrusted-source
dispatch support negative tests through the production controller boundary.

## Evidence So Far

- ADR-0084 and confirmed JTBD-002 align with a framework-neutral testing helper
  that preserves the checked controller boundary. No new ADR or job is needed.
- Independent architecture, JTBD, and cognitive-accessibility reviews passed
  for the source increment and public guidance.
- The complete `@emseepea/testing` package suite passed locally: 16 tests,
  including the complete lifecycle and malformed or untrusted message cases.
- Build, typecheck, Oxlint, package dry-run, public-content review, and staged
  diff checks passed locally.
- Pipeline risk is 5 out of 25 for commit, push, and release.

These are source and local checks. They do not prove exact-commit CI,
publication, registry state, provenance, downloaded-package behavior, or an
exact journey in ChatGPT, Claude, or another adopter host.

## Required Publication Evidence

- The Quality workflow must pass on the exact source commit.
- The Changesets release pull request must contain only the planned generated
  version and changelog changes for `@emseepea/testing@0.10.0`.
- The Quality and Release workflows must pass on the exact version commit.
- Registry readback must confirm version 0.10.0 and the `latest` tag, integrity,
  signature, provenance, and exact release-commit binding.
- The published package must expose the simulator from its public root entry
  point and pass a downloaded clean-install lifecycle journey.

## Review Status, Not Release Status

This document records readiness only. It makes no `PUBLISHED`, registry-
verified, or adopter `PROD_VERIFIED` claim.

- Result: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
