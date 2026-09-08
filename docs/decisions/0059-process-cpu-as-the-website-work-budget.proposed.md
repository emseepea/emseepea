---
status: "proposed"
date: 2026-09-08
human-oversight: confirmed
oversight-date: 2026-09-08
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-08
supersedes: ["ADR-0039"]
---

# Process CPU as the Website Work Budget

## Context and Problem Statement

The website publication check rejected a build because one Chromium renderer
`TaskDuration` sample was 212 milliseconds while its other four samples were
between 82 and 85 milliseconds. The broader observed Chromium process CPU
measurement remained within its approved limit, as did file size and memory.

`TaskDuration` includes renderer activity that the report cannot attribute to
the website. Treating every individual sample as a release gate therefore lets
an isolated browser task reject an otherwise conforming build without showing
that the website consumed excessive total CPU work.

## Decision Drivers

- Keep the publication check sensitive to total browser work, including search
  workers and background processes.
- Avoid release failures caused by an unattributed renderer metric.
- Preserve diagnostic measurements that help investigate real regressions.
- Change as little of the established performance test as possible.

## Considered Options

1. **Gate total Chromium process CPU (chosen)**: retain renderer task, script,
   and layout durations as diagnostics, but hard-gate total observed process
   CPU, memory, file sizes, completeness, and errors.
2. **Keep both CPU gates**: retain the existing per-trial `TaskDuration` and
   total process CPU ceilings.
3. **Remove browser CPU gates**: retain only file-size and memory limits.

## Decision Outcome

Chosen option: **"Gate total Chromium process CPU"**, because it preserves the
broad work limit while avoiding a second, narrower release gate whose isolated
spikes cannot be attributed to the website.

Every required phase of every trial must still record finite, nonnegative
`TaskDuration`, `ScriptDuration`, and `LayoutDuration` values. These values and
their summaries remain in the performance artifact for diagnosis, but they do
not have publication ceilings.

The existing per-phase observed process CPU ceilings remain 800 milliseconds
for desktop and 2,000 milliseconds for the slowed renderer profile. All file
size, memory, environment, trial-completeness, error, artifact, and exact Git
revision requirements remain unchanged.

## Consequences

### Good

- Publication still fails when Chromium performs too much total measured work.
- An isolated renderer task spike no longer rejects a build by itself.
- Reports retain the narrower metrics needed to investigate regressions.

### Neutral

- Historical and new artifacts keep the same schema and remain comparable.
- Every trial and phase is still checked individually.

### Bad

- A renderer-specific regression can pass if total observed process CPU stays
  within its ceiling.
- Process CPU snapshots still cannot observe a process that starts and exits
  between snapshots.

## Confirmation

- Every required trial and phase records finite, nonnegative task, script, and
  layout duration diagnostics.
- A task-duration value above the former ceiling does not fail publication.
- Observed process CPU above 800 milliseconds on desktop or 2,000 milliseconds
  on the slowed renderer profile fails publication.
- Existing file-size, memory, completeness, error, environment, artifact, and
  exact-revision checks remain enforced.

## Pros and Cons of the Options

### Gate Total Chromium Process CPU

- Good: Measures the broad browser work the publication budget intends to
  constrain.
- Bad: Provides less direct enforcement of renderer-only task time.

### Keep Both CPU Gates

- Good: Preserves the strictest existing limits.
- Bad: An isolated unattributed renderer task can reject a release even when
  total measured browser work passes.

### Remove Browser CPU Gates

- Good: Eliminates CPU-related CI variation.
- Bad: Allows browser work to grow without a publication limit.

## Reassessment Criteria

Reassess if repeated process CPU failures show the baseline is unreliable, if
Chromium offers a more attributable browser-work metric, or if renderer task
duration rises consistently while total process CPU remains within budget.
