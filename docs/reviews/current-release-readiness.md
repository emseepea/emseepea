# Current Release Readiness

Date: 2026-10-09

## Feedback annotation overrides

Issue #153 affects applications whose feedback backends or hooks add effects
that differ from the feedback package defaults. One-way submissions can now
override their tool annotations at construction time. Feedback conversations
can configure separate overrides for create, reply, list, and get operations.

Each override accepts only the four MCP boolean hints: `readOnlyHint`,
`destructiveHint`, `idempotentHint`, and `openWorldHint`. Configuration is
strictly validated and copied during construction. Missing values retain the
existing package defaults, including explicit `false` values supplied by the
application.

These annotations describe the complete composed operation, including adopter
backends, hooks, queues, notifications, and external services. They remain MCP
client hints. They do not grant access or replace authentication and
authorization. Collection submission and operator helpers are outside this
change.

## Planned package set

- `@emseepea/feedback@0.8.4`

No other package is planned for this release.

## Architecture and jobs to be done

The additive construction-time configuration follows ADR-0006's checked public
contract, ADR-0066's feedback conversation boundary, and ADR-0110's separation
of feedback roles. It supports JTBD-100's checked MCP capability and JTBD-300's
truthful tool descriptions. No new ADR, job, or persona is required.

## Required checks and residual risk

Build, types, package tests, real MCP discovery tests, documentation checks,
packed fresh installs, standalone initializer checks, and existing performance
budgets must pass. The discovery test must verify operation-specific overrides,
partial merging, explicit `false`, defensive copying, and strict rejection of
invalid runtime configuration.

Exact-source Quality must pass before the generated candidate's Release build.
Only that checked candidate may be merged for promotion. Publish must verify
`latest`, write release records, and merge back to `main`.

The principal risk is an inaccurate annotation causing an MCP client to
describe or confirm a composed effect incorrectly. Strict construction-time
validation, unchanged defaults, per-operation configuration, documentation,
and protocol-level discovery tests control it. Residual risk is within the
project's Low appetite, conditional on every required check passing.

## Conditional release readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full exact-commit qualification,
  Source Quality, Release, and Publish pass.
- Planned release: feedback 0.8.4.
