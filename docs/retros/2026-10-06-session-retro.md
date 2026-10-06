# Session Retrospective: 2026-10-06

## Outcome and accountability

The release completed: PR #143 merged, all changed packages reached npm latest
from checked candidate `62ac79a3153f9f98c488163ff07a2522fb18c67e`, the public
feedback and MCP Events pages were read back, and publish merged into main at
`ab8f75fa93fef42a437bfc137b104e092b052bbd`.
[Publish run 37404060722](https://github.com/emseepea/emseepea/actions/runs/37404060722)
passed promotion, website, records and merge-back. This proves package release
and documentation delivery, not a deployed adopter journey.

I recommended additional merge protection before establishing whether the
existing release pipeline already enforced the required evidence. That detour
blocked a release whose exact candidate pipeline passed. It was unnecessary.
Only the protection additions from this session were removed; the original
configuration and approved release gates were preserved. The ordinary watcher
then finished without an administrator bypass. The lesson is to repair the
observed failure inside the approved path, not infer authority for a new control.

## Briefing Changes

Scanned six session observations: immutable candidate recovery, CLI execution,
PR visibility, registry propagation, mature dependency fixes and scope drift.
Four reusable entries were added to `docs/briefing/releases-and-ci.md`; the
dependency fix remains ticket-specific. Three existing entries were scored.
No removal or rotation was warranted; README scope was refreshed. No entry
reached the Critical Points threshold of 3.

## Signal-vs-Noise Pass

| Entry | Topic | Old | New | Classification | Session evidence |
|---|---|---:|---:|---|---|
| Exact release evidence | releases-and-ci.md | 0 | 1 | signal | Exact Release 37389531442, Publish 37404060722 and registry git-head readback used before completion claim |
| Concurrent trunk cancellation | releases-and-ci.md | 0 | -1 | decay-only | No cancellation recovery observed in retained release evidence; topic first loaded in retro, not used to repair this release |
| First-package preflight | releases-and-ci.md | 1 | 2 | signal | Existing preflight remained in successful Release 37389531442; no package bootstrap or new credential introduced |
| Repair approved release path | releases-and-ci.md | new | 1 | signal | User rejected new controls; only added protection fields removed before standard PR143 merge |
| Immutable replacement | releases-and-ci.md | new | 1 | signal | Candidate 62ac79a3 tree matched official generation; exact run and npm git heads verified |
| Tarball propagation | releases-and-ci.md | new | 1 | signal | Release 37389531442 attempt 1: OpenAPI 0.1.7 returned 404, later 200 without mutation; same-head failed-job retry passed |
| Real recovery CLI and PR visibility | releases-and-ci.md | new | 1 | signal | CLI exit 13 fixed in 181c0431; stale PR head read fixed in b8959680, exact comparisons retained |

Signal delta is +2 minus universal decay of 1. Decay-only delta is -1. No delete
queue, Critical Points promotion/demotion or budget overflow.

## Pipeline Instability and Ticket Routing

| Signal | Category | Specific evidence | Routing |
|---|---|---|---|
| Recovery module import cycle | Release-path instability | Real CLI exited 13; child-process regression and static import in 181c0431 | P019 (Recovery CLI import cycle stops finalization) |
| PR metadata visibility lag | Release-path instability | Quality 37384394609 finalized but rejected a stale PR head; bounded observation repair b8959680 | P020 (Release PR head read lags finalization) |
| Merge-protection detour | Release troubleshooting scope drift | Passing Release 37389531442 did not satisfy added required checks; exact original fields restored, Publish 37404060722 passed | P021 (Release troubleshooting adds unnecessary controls); no new gate |
| Immutable version collisions | Release-path instability | Failed Release 37305524425: git-head mismatch; new candidate 62ac79a3 and replacement versions passed | Update P018 (Release retry reuses occupied versions from divergent commits) |
| Metadata available before tarball | Release-path instability | Release 37389531442 attempt 1: OpenAPI tarball returned 404, later 200; attempt 2 passed | Update P010 (The release gives up waiting before the registry catches up) |
| Mature development dependency fixes | Release-path instability | Quality 37386730493 vulnerability gate failed; scoped override commit 90fa6259 and Quality 37388530000 passed | Update P017 (A known vulnerability in a development dependency blocks trunk) |

The dependency scan still had two no-published-fix findings accepted under
existing policy. Passing the gate is not a clean vulnerability scan.
Ticket capture/update executes through the installed ITIL skills; this report
does not directly change lifecycle states or assert ticket completion.

README inventory currency: clean, 6 packages, 0 drift instances. The legacy RFC
scope advisory failed softly: `rfcs dir not found: docs/rfcs`. This repository
has no legacy RFC population; no RFC scaffolding was added.

## Verification Housekeeping

Read the only pending ticket, P003 (Release workflow lacks first-package
trusted-publisher preflight), and the README Verification Queue. The queue says
`no - not observed` in substance. This release exercised existing package names,
not the missing-name stop branch required by that ticket. It remains pending.
No prior-session `yes - observed` rows required closure. No same-session fix is
closed solely because this release shipped it.

## Context Usage (Cheap Layer)

| Bucket | Bytes | % of total | Change since prior snapshot |
|---|---:|---:|---:|
| memory | 984803 | 47.99% | +121559 |
| decisions | 931045 | 45.37% | +423717 |
| problems | 110944 | 5.41% | +105426 |
| jtbd | 21153 | 1.03% | +7815 |
| briefing | 4029 | 0.20% | +2094 |
| hooks | 0 | 0.00% | 0 |
| skills | 0 | 0.00% | 0 |
| project-claude-md | not measured | not measured | source absent |
| framework-injected | not measured | not measured | no on-disk source |

Top five measured buckets are memory 984803, decisions 931045, problems 110944,
jtbd 21153 and briefing 4029 bytes, measured by the installed shim's glob/wc chain.
Global memory is cross-project; disk size is not actual injected context cost.
The rendered cheap layer is below its 10240-byte defensive ceiling.
Deep analysis auto-fired: `2026-10-06-context-analysis.md`, because the prior
snapshot was 25 days old; decisions/problems also cleared 20% and 10 KB growth.
Per-plugin breakdown is available in `/wr-retrospective:analyze-context`, with
this run explicitly reporting attribution unavailable.

## Ask Hygiene

| Call | Header | Classification | Citation |
|---|---|---|---|
| None in visible retrospective turn | Not applicable | Not applicable | Current tool history has no request_user_input invocation |

Visible-turn lazy/direction/override/silent-framework/taste/correction counts
are all 0. Earlier question ordinals/headers were compacted and are not measured;
these zeros are not whole-session totals. The trail file states that boundary.
Trend shim: `TREND lazy_first=1 lazy_last=0 delta=-1`. Its differing coverage
prevents interpreting this as measured whole-session improvement. It did not
show three consecutive counts at least 2; no enforcement-hook deviation queued.

## Codification Candidates

| Kind | Shape | Target | Observation | Proposed strategy |
|---|---|---|---|---|
| improve | internal code plus regression test | scripts/release-recovery.mjs | Imported-helper tests missed the actual CLI cycle | Preserve real-module-graph child-process coverage; repair already shipped |
| improve | existing CI step plus regression test | .github/workflows/quality.yml | Immediate PR head read raced propagation | Bounded visibility wait with final exact-head and remote comparison; shipped |
| improve | delivery guidance | Existing release troubleshooting guidance | New controls were proposed before evaluating approved pipeline evidence | Establish current configuration and exact pipeline first; no new gate |
| improve | existing registry verification | P010 registry waiting scope | Metadata readiness differed from tarball readiness | Record both observations, retain same-candidate retry boundary |

No framework source, ADR, release control or user memory was changed by this
retro. Future fix strategies do not authorize implementation in this turn.
