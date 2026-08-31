---
status: "proposed"
date: 2026-08-31
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-30
---

# Website Performance Budget

This is an agent-drafted proposal awaiting approval. It does not authorize
enforcement or website publication. This repository uses `pending` for
unapproved decisions; the capture skill calls that state `unconfirmed`.

## Context and Problem Statement

The first website build has measurements from continuous integration (CI).
We need agreed limits before publishing, as required by
[Measured Website Performance Before Publication](0038-measured-website-performance-before-publication.proposed.md).

## Decision Drivers

- Keep pages and local search small and responsive.
- Set limits from recorded measurements, with room for normal variation.
- Check every trial rather than hide a slow trial in an average.

## Considered Options

1. **Adopt the measured-build limits** - Use the proposed limits below.
2. **Keep measuring before choosing limits** - Gather more evidence; publication waits.

## Decision Outcome

Chosen option: **"Adopt the measured-build limits"** is the proposed direction,
because the first build passes them with room for variation. Human approval is
still pending.

### Proposed limits

For sizes, 1 KiB means 1,024 bytes. Compress each file separately with gzip
level 9. Search files are a subset of the totals, not an extra download.

| Compressed files | First build | Proposed maximum |
| --- | ---: | ---: |
| Largest individual HTML page | 9,370 bytes | 24 KiB |
| All CSS files | 27,481 bytes | 40 KiB |
| All JavaScript files | 139,352 bytes | 192 KiB |
| All search files | 277,140 bytes | 384 KiB |
| All files except HTML | 372,328 bytes | 512 KiB |

The next limits apply separately to every initial-load, search-results, and
no-results phase of every trial. An average or median cannot replace them.

| Measurement | Desktop maximum | Slowed-renderer maximum |
| --- | ---: | ---: |
| Main-page task processing | 150 milliseconds | 500 milliseconds |
| Observed browser CPU work | 800 milliseconds | 2,000 milliseconds |
| Browser memory after each phase | 512 MiB | 512 MiB |

One MiB means 1,048,576 bytes. The memory limit is 536,870,912 bytes.

### Measurement conditions

- Run on GitHub's standard Ubuntu 24.04 runner with Node.js 24.
- Record the exact Node.js, Chromium, operating-system, and hardware versions.
- Test every searchable guide in five fresh browser contexts per profile.
- Use light mode, a 900-pixel height, and widths of 1,280 and 320 CSS pixels.
- Apply four-times renderer CPU slowdown only to the 320-pixel profile.
- Serve the built files locally, disable the HTTP cache, and record all errors.
- Do not retry failed trials, discard outliers, or reuse earlier results.

The first build has five searchable guides: 50 trials across both profiles.
Each trial covers page load, the `coffee` search, and a no-results search.
Adding a guide adds five trials per profile. These are browser emulations,
not physical-phone or internet-latency measurements.

Main-page processing is the Chromium DevTools Protocol `TaskDuration` delta.
It measures renderer task time, not whole-browser CPU time. Script and layout
durations overlap it; do not add them together.

Browser CPU work is the observed CPU-time increase across all processes listed
by Chromium. It includes search workers, instrumentation, and background work.
Two snapshots cannot detect a process that starts and exits between them.
Renderer slowdown does not slow every browser process.

Browser memory is the sum of resident memory for those listed processes,
measured after each phase and before forced garbage collection. It includes
Chromium's baseline and resident search-worker and WebAssembly allocations.
Shared pages may be counted more than once. This is not peak memory or unique
physical memory. Unlisted operating-system helpers and the Node.js test server
are outside this measurement. Main-page JavaScript heap is reported separately.

File sizes describe the build inventory. They are not measured hosting transfer
sizes, and a reader does not necessarily fetch every file.

### Baseline evidence

The [first complete browser-process measurement run](https://github.com/windyroad/emseepea/actions/runs/33379441554)
recorded 50 trials with no trial errors. The report uses schema version 2 and
status `measured-not-budgeted`; it did not enforce these proposed limits.

- Tested Git revision: `6e525aebb31f5f078c1a826f2dd0df4d2a511985`.
- Website branch revision: `859d0626a8d6a48b3ff290d6b29ad43fdebc6708`.
- Main parent revision: `ab051c72ea07cb40fd84ef02894e4eddf71feaa1`.
- Build SHA-256: `f8e12f2d96118a04bcfc081c5fb8b6d5c6f71315773d3e8ba279a256aa0e5fae`.
- Node.js 24.20.0; Chromium 151.0.7922.34; Linux 6.17.0-1022-azure x64.
- Runner reported four logical processors and AMD EPYC 9V74 hardware.

Observed desktop/slowed-renderer maxima were 83.958/327.613 milliseconds for
main-page processing and 560/1,230 milliseconds for browser CPU work.
The largest after-phase memory snapshot was 431,792,128 bytes.
These values and identifiers remain here after the downloadable CI artifact's
14-day retention period ends.

## Consequences

### Good

- A checked build must stay within explicit size and browser-work limits.
- Search-worker work is included rather than hidden behind main-page metrics.

### Neutral

- Limits describe this repeatable test environment, not every reader's device.

### Bad

- Runner or browser changes can require a new baseline and review.
- Snapshot memory checks cannot rule out short-lived peaks.

## Confirmation

- Obtain human approval before enforcing the limits or publishing the website.
- Bind the report to the exact Git revision and built-file hashes being published.
- Check every file category and every phase in every required trial.
- Reject missing, invalid, non-finite, or failed measurements and incomplete trials.
- Require all numerical limits to pass; preserve failed results for diagnosis.
- Keep guide and accessibility checks required by the other website decisions.

## Pros and Cons of the Options

### Adopt the measured-build limits

- Good: The existing build supplies a concrete starting point for enforcement.
- Bad: One baseline does not establish long-term runner variation.

### Keep measuring before choosing limits

- Good: More runs could improve confidence in normal variation.
- Bad: The website remains unpublished without an agreed budget.

## Reassessment Criteria

Review the limits when the browser, runner, site features, or measurement method
changes materially, or repeated failures show that the baseline is unreliable.
Do not raise a limit merely to make a failed publication pass.
