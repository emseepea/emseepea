# Problem 022: Accepted-path CPU budget is unqualified on the Node 22 CI profile

**Status**: Open
**Reported**: 2026-10-13
**Priority**: 9 (Medium) — Impact: 3 × Likelihood: 3
**Origin**: internal
**Effort**: S
**JTBD**: JTBD-006
**Persona**: framework-maintainer

## Description

Quality run [38409314809](https://github.com/emseepea/emseepea/actions/runs/38409314809)
on exact main `a3a0d6c8c2d1d75bbb9f970d9e290b287563151f` failed the
Node 22 performance gate. Its three complete ordinary populations returned
PASS, FLAG and PASS. Accepted-request CPU p95 was 4.212, 6.326 and 4.317 ms
against the unchanged 5 ms ceiling. Other budgets passed. Node 24 passed.
The aggregate correctly returned INCONCLUSIVE and did not qualify publication.

## Evidence and boundaries

The failed artifact contains 154 verified entries. Its archive SHA-256 is
`ff7e198f82cdb753e4bf25f2f394d4cbd5ce0819b68a28dd2300e64b5565b8d7`.
The ordinary runner reported Node 22.23.2 on Intel Xeon 6973P-C, four logical
CPUs. Earlier passing control evidence used a different CPU model. Hardware
causation has not been established.

The separate profiled diagnostic passed, but cannot qualify the source.
Its shared-clock evidence shows 33 of 40 accepted-request CPU spikes above
5 ms definitely overlapping garbage collection. Seven do not. Whole-process
profiles also show repeated schema conversion and rejected-response validation
allocations. These observations do not explain the ordinary failure.

## Investigation

Test reuse of captured declaration metadata without changing official protocol
validation, application validation, limits or failure handling. Preserve valid
input transforms, recursive schemas and prompt completion. Freeze one matched
local baseline/candidate experiment before collecting it; preserve all outcomes.
Local Node 24 results cannot substitute for exact-source Node 22 CI evidence.

## Workaround and verification

Keep publication pending until a reviewed repair passes the normal exact-source
pipeline. Do not qualify by rerunning until favourable, weakening the budget,
or accepting a profiled diagnostic instead of ordinary measurements.

P015's completed classification treatment remains intact: the control refused
this mixed result as designed. The runtime/profile cause remains unresolved.

## Related

- [P015 classification treatment](../closed/015-production-boundary-cpu-benchmark-gives-conflicting-results-for-an-unchanged-revision.md)
- [R014 performance classification risk](../../risks/R014-performance-gate-misclassifies-a-revision-when-measurement-variance-is-unclassified.active.md)

## Story Maps

| ID | Title | Status |
|----|-------|--------|
| STORY-MAP-001 | STORY-MAP-001: Share a verified framework change safely | accepted |


## Stories

| ID | Title | Status |
|----|-------|--------|
| STORY-004 | STORY-004: Pass the Request Performance Check on Node 22 | accepted |
