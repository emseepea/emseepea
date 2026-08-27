# Risk R003: Checked Boundaries Fail or Expose Backend Data

**Status**: Active
**Category**: information security
**Identified**: 2026-08-27
**Owner**: Framework security maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

Input mapping, backend calls, or output mapping may bypass their declared
schemas. A caller could then select private backend details, receive unvalidated
data, or trigger the wrong operation.

The failure could affect tools, resources, prompts, templates, or completion.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Four checked boundaries** - Mapped tools validate public input, mapped
  backend input, backend output, and final public output. Implemented in
  `packages/framework/src/index.ts`.
- **Deterministic definitions** - Tool definitions are captured and invalid or
  duplicate registrations fail before serving requests. Implemented in
  `packages/framework/src/index.ts`.
- **One checked execution path** - Direct and mapped tools share authorization,
  deadlines, cancellation, result limits, and safe public error handling.
  Implemented in `packages/framework/src/index.ts`.
- **Boundary failure tests** - Invalid public input, mapped commands, backend
  results, final output, cancellation, and authorization failures are exercised
  through the real HTTP endpoint. Tested in
  `tests/black-box/mapped-adapter.test.mjs` and
  `tests/black-box/resources-prompts.test.mjs`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 5 (Severe)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 5
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. Retain validation at every public and backend boundary. Any new
operation or escape hatch must use the same authorization, validation, tracing,
cancellation, limit, and error path before it can be advertised.

## Monitoring

- **Trigger to re-assess**: Any new operation type, adapter, mapper, schema, or
  dispatch route.
- **Metrics**: Checked boundaries per operation; boundary failures that invoke a
  handler or adapter; unvalidated results emitted at the public endpoint.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0006: Canonical Public Contract and Private Manifest Compilation](../decisions/0006-canonical-public-contract-and-private-manifest-compilation.proposed.md)
  and
  [ADR-0007: Deterministic Execution Kernel and Checked Boundaries](../decisions/0007-deterministic-execution-kernel-and-checked-boundaries.proposed.md)
- Personas affected: framework adopters and their users

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 4 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T01-47-06-commit.md`
- `.risk-reports/2026-08-27T02-00-14-commit.md`
- `.risk-reports/2026-08-27T02-53-14-commit.md`
- `.risk-reports/2026-08-27T03-31-58-commit.md`

These source entries seeded the curated risk. Re-rate when controls, source
evidence, or risk policy change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
- 2026-08-28: Curated controls, ownership, scoring, and treatment from the
  implemented checked execution path and black-box evidence.
