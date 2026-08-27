# Risk R002: Protected Tools Run Without Valid Authorization

**Status**: Active
**Category**: information security
**Identified**: 2026-08-27
**Owner**: Framework security maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

A protected tool may run for a caller who has no valid token or lacks the
required scope. Credentials may also leak through errors, logs, or tool-handler
context.

This could expose backend data or allow actions that the adopter intended to
protect.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Explicit access policy** - Every tool must declare public access or protected
  scopes. Protected tools fail startup without OAuth resource-server
  configuration. Implemented in `packages/framework/src/index.ts`.
- **Authorization before execution** - Token verification, resource checks, and
  scope checks complete before protected handlers or adapters run. Public calls
  receive no authenticated identity. Implemented in
  `packages/framework/src/index.ts`.
- **Information-safe failures** - Authentication errors are sanitized before
  they cross the public boundary. Implemented in
  `packages/framework/src/index.ts`.
- **Zero-call security tests** - Missing, invalid, expired, wrong-resource,
  insufficient-scope, and timed-out authorization outcomes prove zero handler
  and adapter calls. Tested in
  `tests/black-box/oauth-protected-tools.test.mjs`,
  `tests/black-box/mapped-adapter.test.mjs`, and
  `tests/black-box/streaming-progress.test.mjs`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 5
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. Keep the access declaration, verifier boundary, sanitized errors, and
zero-call tests mandatory. A failure in any protected-path security test
withdraws the protected-tool claim until a later exact revision restores it.

## Monitoring

- **Trigger to re-assess**: Any change to authentication, authorization,
  identity context, errors, or logging.
- **Metrics**: Protected authorization outcomes covered by zero-call tests;
  protected calls that reach a handler without verified identity; credential or
  private-error disclosures.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0018: Public Discovery and Invocation-Scoped OAuth Security](../decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md)
- Personas affected: framework adopters and their users

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 2 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T00-22-37-commit.md`
- `.risk-reports/2026-08-27T00-27-20-commit.md`

These source entries seeded the curated risk. Re-rate when controls, source
evidence, or risk policy change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
- 2026-08-28: Curated controls, ownership, scoring, and treatment from the
  implemented authorization boundary and black-box evidence.
