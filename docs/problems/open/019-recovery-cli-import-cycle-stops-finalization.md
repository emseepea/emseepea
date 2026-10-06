# Problem 019: Recovery CLI Import Cycle Stops Finalization

**Status**: Open
**Reported**: 2026-10-06
**Priority**: 6 (Medium) - Impact: 3 × Likelihood: 2 - release preparation stopped; the shipped regression test reduces recurrence
**Origin**: internal
**Effort**: S - retain the CLI regression and review recovery evidence
**WSJF**: 6.0 - Priority 6 × Open multiplier 1.0 / Effort 1
**JTBD**: JTBD-101 - publish installable packages safely
**Persona**: framework-maintainer

## Description

The recovery finalizer could not reach its required release-plan check. Running
the CLI exited with Node.js code 13 and an unsettled top-level await warning.
This interrupted release preparation before a replacement candidate was ready.

## Symptoms

- The CLI stopped during its dynamic import of the release-plan checker.
- Tests that called the exported finalizer did not exercise this entry point.

## Workaround

Use the corrected static-import implementation in
`181c0431665f4399b9a69b4cf07a34a17571f7e6`. Retain all candidate and
provenance checks before finalization.

## Impact Assessment

- **Who is affected**: maintainers recovering a partially published release.
- **Frequency**: observed in this session through the CLI entry point.
- **Severity**: release preparation stops; no incorrect package publication was
  established by this failure.
- **Analytics**: the observed exit and the fix commit below.

## Root Cause Analysis

The awaited dynamic import joined a module import cycle while the CLI's
top-level await was still unsettled. A static import removes that deadlock.

### Investigation Tasks

- [x] Identify the dynamic-import cycle at the CLI boundary.
- [x] Add a child-process regression that reaches the required release-plan
  check and rejects the unsettled-await warning or an unexpected candidate write.
- [ ] Review the shipped CLI behaviour in a later session before lifecycle closure.

## Proposed Fix Strategy

Retain the static import and the actual CLI child-process regression. Keep the
existing release-plan and immutable-version checks. No additional release gate
is proposed.

## Session Evidence

- [Fix commit](https://github.com/emseepea/emseepea/commit/181c0431665f4399b9a69b4cf07a34a17571f7e6)
  changes `scripts/release-recovery.mjs` and adds the behavioural test in
  `tests/docs/release-recovery.test.mjs`.
- The subsequent recovery produced frozen candidate
  `62ac79a3153f9f98c488163ff07a2522fb18c67e`. This records recovery evidence;
  it does not close a newly captured ticket in the same retrospective.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: P018

## Related

Captured via `/wr-itil:capture-problem`. Fresh-context hang-off review returned
`PROCEED_NEW`: P001 concerns initializer bumps; P014 dependency ownership;
P016 feedback-test timing; P018 occupied immutable versions; P003 package-name
preflight. None covers this CLI import cycle.
