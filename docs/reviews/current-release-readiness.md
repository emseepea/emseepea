# Current Release Readiness

Date: 2026-10-08

## Feedback discovery and MCP client security repairs

Issue #148 still affects collection submissions, conversation operations, and
operator reads. Their descriptors now explicitly advertise
`destructiveHint: false`. Existing read-only, idempotent, open-world,
authorization, and persistence behavior is preserved. Protocol assertions
cover public and protected discovery through real MCP clients.

Issue #151 upgrades the direct MCP client to 2.2.0 and accepts its required
core 2.2.0 dependency. The server SDK and its core remain at 2.0.0. Starter
development dependencies move to the current testing workspace so generated
projects will receive the patched testing release. No server runtime behavior
or application backend is changed. The lockfile contains one MCP client
version, 2.2.0, rather than retained vulnerable client copies. The semantic CLI
checks and records that exact dependency version.

## Planned package set

- `@emseepea/feedback@0.8.2`
- `@emseepea/testing@0.21.6`
- All eleven `@emseepea/create-*` initializer packages at `0.1.8`.

The initializer patches are explicitly planned because their development
checks previously installed testing 0.20.5 and the affected client. Runtime
framework, UI, and website packages are not planned for release. Direct
adopter dependency upgrades remain separate from these framework repairs.

## Architecture and jobs to be done

The annotation repair follows ratified ADR-0006's checked public contract,
ADR-0066's append-only feedback operations, and ADR-0110's collection roles.
The security repair follows ADR-0101's dependency-scanning boundary and
JTBD-101's safe, installable publication job. The initializer changes support
JTBD-001's checked generated project. No new ADR, job, or persona is needed
for these repairs.

Issues #145, #146, and #150 need human architecture decisions before their
new browser, dynamic inventory, and configurable execution boundaries can be
implemented. Reviewed issue replies identify concrete decisions and missing
setup details. These features are not part of this release.

The Codex adapter requested in #144 is already released. A genuine local
three-trial check timed out without completed tool transcripts. Retained
machine evidence records the failure; it is not a successful native-provider
claim. The issue reply requests a supported, working authorized setup and a
persisted-data fixture before closing the remaining live acceptance checks.

## Required checks and residual risk

Build, types, protocol tests, OAuth credential-isolation checks, packed fresh
installs, standalone initializer checks, vulnerability scanning, and the
existing performance budgets must pass. New dependency compatibility and
discovery annotations must be verified at the public boundary. Local testing
must not replace registry integrity, signature, provenance, or install checks.

Exact-source Quality must pass before the generated candidate's Release
build. Only that checked candidate may be merged for promotion. Publish must
verify `latest`, write release records, and merge back to `main`. Failed
semantic trials are not retried. The existing benchmark diagnostics retain
original measurements and label instrumented runs separately; they cannot
override a failed budget.

The principal risk is compatibility between the patched client/core and the
unchanged server SDK. Public-boundary, credential-isolation, and fresh-install
checks control it. Residual risk is within the project's Low appetite,
conditional on every required check passing. The advisory is not evidence of
an Em See Pea credential leak or a demonstrated exploit.

## Conditional release readiness

- Result: PASS, conditional on required qualification and publication gates.
- Publication status: NOT READY until full exact-commit qualification,
  Source Quality, Release, and Publish pass.
- Planned releases: feedback 0.8.2, testing 0.21.6, and eleven initializers 0.1.8.
