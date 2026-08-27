# Risk R006: Work Outlives Deadlines or Resource Bounds

**Status**: Active
**Category**: operational
**Identified**: 2026-08-27
**Owner**: Framework runtime maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

Backend calls, token verification, or streaming work may continue after a
request is cancelled or timed out. Requests or responses may also exceed their
intended limits.

This could waste adopter resources, retain sensitive work longer than expected,
or make a server unavailable under load.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 12
- **Inherent Band**: High

## Controls

- **Shared deadline and cancellation signal** - Tool, adapter, resource, prompt,
  template, completion, verifier, and progress paths receive the same bounded
  request context. Implemented in `packages/framework/src/index.ts`.
- **Disconnect propagation** - Request aborts and response closes cancel
  cooperating downstream work. Implemented in
  `packages/framework/src/index.ts`.
- **Bounded public results** - Application results and completion candidate sets
  are size-checked before emission. Implemented in
  `packages/framework/src/index.ts`.
- **Runtime boundary tests** - Timeouts, disconnects, concurrent isolation,
  request limits, response limits, and terminal streaming are exercised through
  the real endpoint. Tested in `tests/black-box/mapped-adapter.test.mjs`,
  `tests/black-box/resources-prompts.test.mjs`,
  `tests/black-box/production-boundary.test.mjs`, and
  `tests/black-box/streaming-progress.test.mjs`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 4
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate. Keep all framework-owned waits and emissions bounded. Cancellation is
cooperative: documentation and claims must not imply that Em See Pea can stop
verifier or backend input/output that ignores the supplied abort signal.

## Monitoring

- **Trigger to re-assess**: Any deadline, cancellation, verifier, streaming,
  request-limit, or response-limit change.
- **Metrics**: Operations exceeding their deadline; cooperating handlers that
  miss cancellation; rejected oversized requests, results, or candidate sets;
  streaming work continuing after terminal completion.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0009: Capability-Scoped Reliability, Effects, and State](../decisions/0009-capability-scoped-reliability-effects-and-state.proposed.md),
  [ADR-0010: POST-Scoped Streaming, Progress, and Subscriptions](../decisions/0010-post-scoped-streaming-progress-and-subscriptions.proposed.md),
  and
  [ADR-0012: Typed Operations and OpenTelemetry Boundary](../decisions/0012-typed-operations-and-opentelemetry-boundary.proposed.md)
- Personas affected: framework adopters and their users

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 3 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T00-22-37-commit.md`
- `.risk-reports/2026-08-27T00-27-20-commit.md`
- `.risk-reports/2026-08-27T12-00-32-commit.md`

These source entries seeded the curated risk. Re-rate when controls, source
evidence, or risk policy change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
- 2026-08-28: Curated controls, ownership, scoring, and treatment from the
  implemented deadline, cancellation, and resource-bound evidence.
