# Problem 004: Problem Backlog Parser Couples to an Unexplained Exact Heading

**Status**: Open
**Reported**: 2026-09-11
**Priority**: 6 (Medium) — Impact: 2 × Likelihood: 3 — derived at capture because the failure blocks a local governance command when normal documentation wording changes
**Origin**: internal
**Effort**: S — a focused parser contract and regression test should cover the heading boundary
**Jobs To Be Done (JTBD)**: JTBD-102
**Persona**: framework-maintainer

## Description

`wr-itil-reconcile-readme` requires the exact heading `## WSJF Rankings` in
`docs/problems/README.md`. During this retrospective, cognitive-accessibility
review required expanding the unexplained acronym. Changing the heading to
`## Weighted Shortest Job First (WSJF) Rankings` caused reconciliation to stop
with `PARSE_ERROR: '## WSJF Rankings' header missing`.

The immediate repair restored the parser-stable heading and added the expansion
in the next paragraph. Reconciliation then exited successfully. The parser's
machine-readable marker remains coupled to reader-facing wording, and no
focused guard warned about that contract before the first commit.

## Symptoms

- A semantically equivalent, clearer heading was treated as a missing section.
- The failure appeared only when the reconciliation command was rerun after the
  documentation commit.

## Workaround

Keep the exact `## WSJF Rankings` heading and explain Weighted Shortest Job First
immediately below it.

## Impact Assessment

- **Who is affected**: maintainers editing the problem backlog index.
- **Frequency**: possible whenever the reader-facing heading is clarified or
  translated without knowledge of the parser token.
- **Severity**: local reconciliation stops; no package or remote state changes.
- **Analytics**: one reproducible parse failure and one successful rerun after
  restoring the exact heading during the 2026-09-11 retrospective.

## Root Cause Analysis

### Investigation Tasks

- [ ] Decide whether the parser should accept an expanded heading or use a
  separate stable marker that does not constrain reader-facing wording.
- [ ] Add a focused regression test for the chosen accessible heading contract.

## Fix Strategy

**Shape**: internal code and test fixture. Update the installed reconciliation
parser's section detection and add a regression fixture that preserves both
machine parsing and the first-use expansion of Weighted Shortest Job First.
Evidence: the expanded heading produced the exact missing-header parse error;
the stable heading plus adjacent expansion reconciled successfully.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: Problem 002 (Release Readiness Verifier Only Tests
  Fixture-Like Stable PASS Marker), which tracks the same reader-facing text and
  machine-marker coupling in a different release surface.

## Related

- JTBD-102, Keep Guidance Accurate.
- `docs/problems/README.md`.
- Captured via `/wr-itil:capture-problem`; the title-only duplicate check found
  no matching ticket.
- The duplicate pre-filter found no open or verification-pending ticket sharing
  the cited file path.
