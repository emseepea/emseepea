# Current Release Readiness

Date: 2026-09-13

Release verification is not complete for the runner-neutral server cleanup.
That change is planned for `@emseepea/testing@0.11.0`, following the separate
cumulative release that published the MCP Apps host simulator and React theme
helper.

## Planned Release Batch

- `@emseepea/testing@0.11.0`

## Change for MCP Developers

MCP developers can start an Em See Pea server or child-process server without a
test context and close it explicitly in Vitest, Jest, another runner, or a plain
script. Existing `{ after }` cleanup remains available and registers the same
public `close()` operation automatically.

## Evidence So Far

- Confirmed JTBD-001 and JTBD-100 align explicit lifetime ownership with tests
  through the real public boundary. No new ADR or job is needed.
- Independent architecture, JTBD, cognitive-accessibility, and source reviews
  passed for the server-cleanup increment and public guidance.
- The complete `@emseepea/testing` package suite passed locally: 20 tests,
  including the host simulator, explicit and automatic cleanup, repeated and
  concurrent close, port refusal after close, and failure-path cleanup.
- The package build, typecheck, Oxlint, package dry-run, public-content review,
  focused protocol suite, and staged diff checks passed locally.
- Pipeline risk is 5 out of 25 for commit, push, and release.

These are source and local checks. They do not prove exact-commit continuous
integration, publication, registry state, provenance, downloaded-package
behavior, or an exact journey in ChatGPT, Claude, or another adopter host.

## Prior Cumulative Release Boundary

The preceding cumulative release published `@emseepea/testing@0.10.0`,
`@emseepea/react@0.2.0`, `@emseepea/create-react-ui-server@0.0.28`, and ten
initializer patch releases. Quality runs `34745003015` and `34745474030`
passed, and release run `34745860395` completed publication, registry checks,
and downloaded-package verification for merge `dcd1829b`. That evidence covers
the host simulator and React theme helper. It does not cover this pending
runner-neutral cleanup.

## Required Publication Evidence

- The Quality workflow must pass on the exact cleanup source commit.
- The Changesets release pull request must contain only the generated version
  and changelog changes for `@emseepea/testing@0.11.0`.
- The Quality and Release workflows must pass on the exact version commit.
- Registry readback must confirm version `0.11.0`, the `latest` tag, integrity,
  signature, provenance, and exact release-commit binding.
- The downloaded published package must expose the public server starters and
  return handles whose `close()` operation passes clean-install lifecycle and
  failure-path cleanup journeys.

## Review Status, Not Release Status

This document records readiness only. It makes no `PUBLISHED`, registry-
verified, exact-host, or adopter `PROD_VERIFIED` claim for the cleanup change.

- Result: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
