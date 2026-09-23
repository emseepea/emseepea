# Problem Backlog

> Last reviewed: 2026-09-24 **P003 verification pending** — The release now checks package-name prerequisites before publication
> Run `/wr-itil:manage-problem review` to refresh.

## WSJF Rankings

Weighted Shortest Job First (WSJF) ranks higher-value, lower-effort work first.

| WSJF | ID | Title | Severity | Status | Effort | Reported | Origin |
|------|-----|-------|----------|--------|--------|----------|--------|
| 15.0 | P005 | Branch push is ungated, so untested changes reach continuous integration | 15 (High) | Open | S | 2026-09-20 | internal |
| 12.0 | P007 | The shipped package guide is silent on open-by-default result schemas | 12 (High) | Open | S | 2026-09-20 | internal |
| 12.0 | P010 | The release gives up waiting before the registry catches up | 12 (High) | Open | S | 2026-09-20 | internal |
| 12.0 | P011 | The release risk gate cannot be satisfied from a worktree | 12 (High) | Open | S | 2026-09-20 | internal |
| 10.0 | P001 | Changesets omit initializer bumps when embedded template dependencies change | 20 (Very High) | Open | M | 2026-09-11 | internal |
| 9.0 | P006 | A strict result schema opens when it is piped from an open object | 9 (Medium) | Open | S | 2026-09-20 | internal |
| 6.0 | P004 | Problem backlog parser couples to an unexplained exact heading | 6 (Medium) | Open | S | 2026-09-11 | internal |
| 6.0 | P008 | The release package list is transcribed by hand into the readiness record | 12 (High) | Open | M | 2026-09-20 | internal |
| 6.0 | P009 | A tool call can fail after the backend has recorded the work | 12 (High) | Open | M | 2026-09-20 | internal |
| 5.0 | P014 | Direct dependencies have no identified owner or purpose | 10 (High) | Open | M | 2026-09-23 | internal |
| 3.0 | P013 | Feedback event construction is duplicated across four adapters | 6 (Medium) | Open | M | 2026-09-23 | internal |
| 2.0 | P012 | Framework runtime is concentrated in one multi-responsibility module | 8 (Medium) | Open | L | 2026-09-23 | internal |

## Verification Queue

Fix released, awaiting verification. Sorted by release date, oldest first.

| ID | Title | Released | Fix summary | Likely verified? |
|----|-------|----------|-------------|------------------|
| P002 | Release readiness verifier only tests fixture-like stable PASS marker | 2026-09-20 | Every `npm test` now checks the live readiness record still has both marker labels. Verdicts are still checked only at release time. | no — not observed |
| P003 | Release workflow lacks first-package trusted-publisher preflight | 2026-09-24 | The release checks every public package name before publication and stops with separate bootstrap guidance when a name is absent. | no — not observed |

## Parked

None parked.

| ID | Title | Reason | Parked since |
|---|---|---|---|
