# Context Analysis: 2026-09-11

> Source: `/wr-retrospective:analyze-context`.
> Methodology: byte counts on disk, per-plugin decomposition when resolvable,
> and per-turn attribution when a session log exposes usage data.
> Cheap-layer baseline: the installed `wr-retrospective-measure-context-budget`
> command.

## Bucket Totals

| Bucket | Bytes | Percentage of measured total | Change from prior |
|---|---:|---:|---:|
| memory | 863,244 | 62.04% | not measured: no prior snapshot |
| decisions | 507,328 | 36.46% | not measured: no prior snapshot |
| jtbd | 13,338 | 0.96% | not measured: no prior snapshot |
| problems | 5,518 | 0.40% | not measured: no prior snapshot |
| briefing | 1,935 | 0.14% | not measured: no prior snapshot |
| hooks | 0 | 0.00% | not measured: no prior snapshot |
| skills | 0 | 0.00% | not measured: no prior snapshot |
| project-claude-md | not measured | not measured | source absent |
| framework-injected | not measured | not measured | no on-disk source |

Total measured: **1,391,363 bytes**. This is the first project snapshot, so
change from a prior measurement is unavailable.

## Per-Plugin Decomposition

Per-plugin attribution was not measured because the installed helper could not
resolve plugin source from this adopter repository. The zero-byte hooks and
skills rows therefore describe project-local sources only; they do not measure
framework-injected plugin content.

## Top Five Offenders

| Surface | Bytes | Bucket | Measurement method |
|---|---:|---|---|
| `docs/decisions/README.md` | 109,930 | decisions | `wc -c` over the largest file in the bucket |
| `project_xero_security_standard_readiness.md` in another project's Claude memory | 27,176 | memory | `wc -c` over the helper's global memory glob |
| `project_pivot_xero_first_connector_marketplaces.md` in another project's Claude memory | 22,062 | memory | `wc -c` over the helper's global memory glob |
| `MEMORY.md` in another project's Claude memory | 16,777 | memory | `wc -c` over the helper's global memory glob |
| `docs/decisions/0066-pluggable-detailed-feedback-conversations-and-event-hooks.proposed.md` | 15,850 | decisions | `wc -c` over the second-largest decision file |

The memory total includes every readable Claude project memory directory, not
only this repository. It must not be interpreted as this project's memory cost.

## Per-Turn Attribution

Per-turn attribution was not measured because the available `.afk-run-state`
JSONL file contains no usage fields for this session.

## Suggestions

1. **Memory measurement**: filter the 863,244-byte global memory glob to this
   project before using it as a project context signal. Estimated saving: not
   estimated, because no prior project-filtered measurement exists.
2. **Decision index**: inspect the 109,930-byte decision compendium for a
   generated or paged index boundary before loading it wholesale. Estimated
   saving: not estimated, because no comparable prior snapshot exists.
3. **Jobs to be done**: keep the 13,338-byte corpus selectively loaded by
   persona and job rather than as one source. Estimated saving: not estimated,
   because no per-file prompt-load trace exists.
4. **Problem records**: retain the 5,518-byte ticket corpus on demand and load
   only matching states or identifiers. Estimated saving: not estimated,
   because no per-turn attribution is available.
5. **Briefing**: the 1,935-byte briefing tree is below the 5,120-byte per-topic
   advisory ceiling; no rotation is indicated by the measured evidence.

## Policy Breaches

| Budget | Offender | Bytes | Citation |
|---|---|---:|---|
| SKILL.md size cluster above 50 KB | installed `wr-retrospective:run-retro` `SKILL.md` | 95,907 | ADR-038 size-cluster check named by the deep-analysis skill |

The briefing-budget advisory reported no over-budget topic files. No
project-local hook reminder was available to sample.

<!--
context-snapshot:
  total-bytes: 1391363
  hooks: 0
  skills: 0
  memory: 863244
  briefing: 1935
  decisions: 507328
  problems: 5518
  jtbd: 13338
  project-claude-md: not measured
  framework-injected: not measured
  measurement-method: byte-count-on-disk
  measured-at: 2026-09-11T04:15:21Z
-->
