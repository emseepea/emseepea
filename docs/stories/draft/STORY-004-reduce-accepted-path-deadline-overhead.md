---
status: draft
story-id: reduce-accepted-path-deadline-overhead
reported: 2026-10-20
decision-makers: [Tom Howard]
problems: [P022]
jtbd: [JTBD-100]
rfcs: [RFC-004]
story-maps: [STORY-MAP-001]
estimated-effort: S
---

# STORY-004: Pass the Request Performance Check on Node 22

**Reported**: 2026-10-20
**Problems**: P022
**JTBD**: JTBD-100
**RFCs**: RFC-004
**Story Maps**: STORY-MAP-001
**Estimated effort**: S

## User value

In order to publish releases safely, as a framework maintainer, I want valid
requests to stay within the existing Node 22 performance limit. Cancellation
and timeouts must keep working.

## Acceptance criteria

- [ ] The frozen one-run-per-arm Node 22 experiment is preserved and reports
      its mixed CPU result without a favourable rerun.
- [ ] Request cancellation, invocation cancellation, timeout reasons, safe
      public errors, single execution and cleanup remain behaviourally covered.
- [ ] The accepted path replaces the nested abort-signal combinators with one
      bounded controller, one timer and explicit listener cleanup.
- [ ] All ordinary local benchmark populations remain within the unchanged CPU,
      allocation and wire budgets.
- [ ] The full local qualification suite passes on the candidate source.
- [ ] The normal exact-source Node 22 Quality job passes without weakening or
      bypassing the production-boundary classifier.
- [ ] The repaired framework package is published and independently verified
      before P022 closes.

## Driving problem trace

P022 records that accepted-request CPU exceeded the unchanged production
boundary on the exact Node 22 CI profile while Node 24 and the other budgets
passed.

## JTBD trace

JTBD-100 requires framework maintainers to extend and maintain the supported
protocol without weakening validation, cancellation, deadlines or safe failure
behaviour.

## Implementation notes

Keep the 5 ms CPU ceiling and every protocol, application-validation, limit,
security and error-mapping boundary unchanged. Exact-source Node 22 CI remains
the qualifying evidence; the local matched experiment is diagnostic evidence.

## Dependencies

- **Blocks**: P022 verification and the pending package release.
- **Blocked by**: STORY-MAP-001 ratification of RFC-004.

## Related

- R014 performance-gate classification risk.
- ADR-0014 production JSON boundary performance budget.

(captured via `/wr-itil:capture-rfc`; expand at the next
`/wr-itil:manage-story` invocation)
