# Problem Backlog

> Last reviewed: 2026-09-29 **P017 opened** — A known vulnerability in a development dependency blocks trunk
> Run `/wr-itil:review-problems` to refresh Weighted Shortest Job First (WSJF) rankings.

## WSJF Rankings

Development-work queue only. Problems that can bypass normal controls appear
first, followed by externally reported problems, then internally reported
problems. Within each group, rows sort by WSJF score, Known Error before Open,
effort, reported date, and ID.

| WSJF | ID | Title | Severity | Status | Effort | Reported | Origin |
|------|-----|-------|----------|--------|--------|----------|--------|
| 10.0 | P001 | Changesets omit initializer bumps when embedded template dependencies change | 20 (Very High) | Open | M | 2026-09-11 | internal |
| 24.0 | P007 | The shipped package guide is silent on open-by-default result schemas | 12 (High) | Known Error | S | 2026-09-20 | internal |
| 24.0 | P010 | The release gives up waiting before the registry catches up | 12 (High) | Known Error | S | 2026-09-20 | internal |
| 24.0 | P011 | The release risk gate cannot be satisfied from a worktree | 12 (High) | Known Error | S | 2026-09-20 | internal |
| 24.0 | P016 | Feedback deadline test flakes under qualification load | 12 (High) | Open | S | 2026-09-29 | internal |
| 18.0 | P006 | A strict result schema opens when it is piped from an open object | 9 (Medium) | Known Error | S | 2026-09-20 | internal |
| 15.0 | P015 | Production-boundary CPU benchmark gives conflicting results for an unchanged revision | 15 (High) | Known Error | M | 2026-09-24 | internal |
| 12.0 | P004 | Problem backlog parser couples to an unexplained exact heading | 6 (Medium) | Known Error | S | 2026-09-11 | internal |
| 12.0 | P008 | The release package list is transcribed by hand into the readiness record | 12 (High) | Known Error | M | 2026-09-20 | internal |
| 12.0 | P009 | A tool call can fail after the backend has recorded the work | 12 (High) | Known Error | M | 2026-09-20 | internal |
| 9.0 | P017 | A known vulnerability in a development dependency blocks trunk | 9 (Medium) | Open | S | 2026-09-29 | internal |
| 5.0 | P014 | Direct dependencies have no identified owner or purpose | 10 (High) | Open | M | 2026-09-23 | internal |
| 3.0 | P013 | Feedback event construction is duplicated across four adapters | 6 (Medium) | Open | M | 2026-09-23 | internal |
| 2.0 | P012 | Framework runtime is concentrated in one multi-responsibility module | 8 (Medium) | Open | L | 2026-09-23 | internal |

## Verification Queue

Fix released, awaiting verification. Sorted by release date, oldest first.

| ID | Title | Released | Fix summary | Likely verified? |
|----|-------|----------|-------------|------------------|
| P003 | Release workflow lacks first-package trusted-publisher preflight | 2026-09-24 | The release checks every public package name before publication and stops with separate bootstrap guidance when a name is absent. | no — not observed |

## Inbound Upstream Reports

| # | Source | Title | Author | Created | Classification | Matched local ticket |
|---|--------|-------|--------|---------|----------------|----------------------|
| _No inbound discovery pass has run yet. Run `/wr-itil:review-problems` to poll configured channels._ | | | | | | |

## Parked

None parked.

| ID | Title | Reason | Parked since |
|---|---|---|---|

## Closed

| ID | Title | Closed | Evidence |
|----|-------|--------|----------|
| P005 | [Branch push is ungated, so untested changes reach continuous integration](closed/005-branch-push-is-ungated-so-untested-changes-reach-ci.md) | 2026-09-24 | Installed hook accepted exact commit `0c28ae0`; Quality run `35964172151` passed for that SHA. |
| P002 | [Release readiness verifier only tests fixture-like stable PASS marker](closed/002-release-readiness-verifier-only-tests-fixture-like-stable-pass-marker.md) | 2026-09-29 | Release run `35818485686` passed Prepare package evidence on exact release head `5d163f9be1478f9ebea1558c0e36ab760d0370aa`. |
