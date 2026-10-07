# Context Analysis: 2026-10-06

Source: installed `wr-retrospective:analyze-context`, automatically invoked by
the retrospective cadence rule. Previous snapshot: 2026-09-11, 25 days earlier.
Method: byte counts on disk from the installed measurement shim. These are
source sizes, not measured prompt tokens or session usage.

## Bucket Totals

| Bucket | Bytes | % of measured total | Change since 2026-09-11 |
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

Total: 2051974 bytes, +660611 since the prior snapshot. Measurement taken after
briefing edits and before this retro's delegated problem captures.

The helper's memory glob spans other projects. Its total is not this project's
memory cost. Zero hooks/skills rows cover project-local globs only; installed
plugin instructions injected into this session are not included.

## Per-Plugin Decomposition

The installed `wr-retrospective-list-plugin-attribution` returned
`PLUGIN-ATTRIBUTION not-measured reason=no-plugin-source-resolvable`.
No plugin-level totals are inferred from that result.

## Top Five Source Buckets

| Source | Bytes | Measurement method |
|---|---:|---|
| Global memory glob | 984803 | Installed measure-context-budget helper, glob plus wc -c |
| Decision corpus | 931045 | Same helper, docs/decisions/*.md |
| Problem corpus and indexes | 110944 | Same helper, flat and per-state enumeration |
| Job/persona corpus | 21153 | Same helper, JTBD enumeration |
| Briefing tree | 4029 | Same helper, docs/briefing/*.md |

Additional sampled surfaces: `docs/decisions/README.md` is 180307 bytes;
`docs/decisions/0098-publish-on-merge-to-a-publish-branch.proposed.md` is 38945
bytes. Direct `wc -c` measurements identify these surfaces; the helper's
decision aggregate additionally follows its own glob, including ignored files.

## Per-Turn Attribution

Not measured: no explicitly supplied session log or accessible usage-bearing
AFK log was used. Compaction occurred; byte totals cannot reconstruct lost
per-turn tool calls or classify individual historical question headers.

## Suggestions

1. Scope the 984803-byte global memory measurement to the current project before
   interpreting it as project context. Comparable project-filtered prior and
   savings: not estimated, no prior data. No memory files changed.
2. Load relevant decisions rather than the 180307-byte decision index wholesale.
   Prior index measurement was 109930 bytes on 2026-09-11. Prompt savings are
   not estimated because actual session loading was not measured.
3. Select matching problem records from the 110944-byte corpus. Prompt savings:
   not estimated, no per-turn prior data.
4. Load relevant persona/jobs from the 21153-byte corpus. Prompt savings:
   not estimated, no per-turn prior data.
5. Retain the 4029-byte briefing tree without rotation: its individual topic
   files passed the 5120-byte advisory. No savings proposed.

These are measurement findings, not authorization for source or framework edits.

## Policy Breaches and Limits

| Budget or limit | Surface | Bytes | Evidence |
|---|---|---:|---|
| Installed skill size-cluster threshold, 50000 bytes | Installed run-retro SKILL.md | 95907 | Direct wc -c; deep-layer skill's size-cluster check |

The briefing-budget shim returned no OVER rows. Project-local subsequent-prompt
hook branches were unavailable to sample; their 150-byte budget is not verified.
The skill-size finding existed in the prior snapshot too; it is not claimed as
a new regression or a project-code issue.

<!--
context-snapshot:
  total-bytes: 2051974
  hooks: 0
  skills: 0
  memory: 984803
  briefing: 4029
  decisions: 931045
  problems: 110944
  jtbd: 21153
  project-claude-md: not measured
  framework-injected: not measured
  measurement-method: byte-count-on-disk
  measured-at: 2026-10-06
-->
