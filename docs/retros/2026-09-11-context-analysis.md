# Context Analysis, 11 September 2026

> Source: `/wr-retrospective:analyze-context` under ADR-043.
> Method: on-disk byte counts plus installed-plugin decomposition. Per-turn
> attribution was unavailable because the accessible JSONL file had no usage
> fields.

## Bucket Totals

There is no prior snapshot for comparison.

| Bucket | Bytes | Percentage of measured total | Change from prior |
|--------|------:|-----------------------------:|-------------------|
| Memory | 863,244 | 62.4% | Not measured: no prior snapshot |
| Decisions | 507,328 | 36.7% | Not measured: no prior snapshot |
| Jobs to Be Done | 13,338 | 1.0% | Not measured: no prior snapshot |
| Hooks | 0 | 0.0% | Not measured: project source absent |
| Skills | 0 | 0.0% | Not measured: project source absent |
| Briefing | Not measured | Not measured | Source absent |
| Problems | Not measured | Not measured | Source absent |
| Project instructions | Not measured | Not measured | Source absent |
| Framework-injected context | Not measured | Not measured | No on-disk source |

Measured total: 1,383,910 bytes. Measurement source:
`wr-retrospective-measure-context-budget .`.

## Installed Plugin Decomposition

The cache-fallback helper measured 21,818 bytes of retrospective hooks and
121,028 bytes of retrospective skills. These values are not included in the
project-local Hooks and Skills bucket rows above. Measurement source:
`wr-retrospective-list-plugin-attribution .` with the installed plugin's `bin`
directory on `PATH`.

| Plugin | Hooks | Skills |
|--------|------:|-------:|
| `wr-retrospective` | 21,818 | 121,028 |

## Largest Measured Surfaces

| Surface | Bytes | Bucket | Measurement |
|---------|------:|--------|-------------|
| User memory store, aggregate | 863,244 | Memory | Context-budget helper |
| `docs/decisions/README.md` | 109,930 | Decisions | `wc -c` |
| Installed `run-retro/SKILL.md` | 95,907 | Skills | `wc -c` |

## Per-Turn Attribution

Per-turn attribution: not measured because the accessible session JSONL file
contains no usage fields.

## Suggestions

1. Move long operational clauses from the installed `run-retro/SKILL.md` into
   lazily loaded references while preserving its executable contract. Estimated
   saving: not estimated because there is no comparable prior snapshot.
2. Keep `docs/decisions/README.md` generated and consider a split index only if
   readers or tools cannot consume its current 109,930 bytes. Estimated saving:
   not estimated because there is no comparable prior snapshot.
3. Preserve memory compaction as the owner of the external user memory store;
   this repository should not edit it. Estimated saving: not estimated because
   there is no comparable prior snapshot.

## Policy Breaches

| Budget | Offender | Bytes | Citation |
|--------|----------|------:|----------|
| SKILL.md size over 50 KB | Installed `run-retro/SKILL.md` | 95,907 | ADR-038 cluster check from the deep-analysis contract |

<!--
context-snapshot:
  total-bytes: 1383910
  hooks: 0
  skills: 0
  memory: 863244
  briefing: not measured
  decisions: 507328
  problems: not measured
  jtbd: 13338
  project-claude-md: not measured
  framework-injected: not measured
  measurement-method: byte-count-on-disk
  measured-at: 2026-09-11T03:50:08Z
-->
