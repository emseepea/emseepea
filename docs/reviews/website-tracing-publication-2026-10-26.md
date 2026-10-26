# Website tracing publication evidence

Date: 2026-10-26. Status: **SOURCE ADDED; PUBLICATION BLOCKED**.

[Increment #192](https://github.com/emseepea/emseepea/issues/192) implements the
user's requested website follow-up to the completed npm tracing release.
The target is a discoverable, runnable guide on the live website by Wednesday
afternoon, 28 October 2026, Australia/Sydney. That result remains incomplete.

## Implemented and locally verified

The new `website/src/content/docs/tracing.md` contains the released README's
OpenTelemetry example, setup responsibilities, expected span relationships,
shutdown and privacy guidance. The sidebar and existing observability
explanation link to it. A Changeset selects only the private website workspace.

A fresh temporary project outside the checkout installed registry server
0.25.1 and ran the website JavaScript verbatim. The actual request returned
HTTP 200. Both exported spans used trace ID
`1234567890abcdef1234567890abcdef`:

| Span | Span ID | Parent ID |
| --- | --- | --- |
| `mcp.request` | `7277f331624dc49f` | incoming `1234567890abcdef` |
| `backend.read` | `ef90e3ff31623d79` | request `7277f331624dc49f` |

Graceful flush/shutdown passed. The example uses a synthetic backend and console
exporter; it does not establish production telemetry operation. The receipt
was captured at `/tmp/emseepea-website-guide-receipt.json`.

Website build and all 16 existing website checks passed, including browser,
accessibility, mobile/desktop and light/dark output. Full clean-commit
qualification passed on Node 24.22.1/npm 12.0.2 for both the initial source and
the whitespace correction, using existing repository scripts and normal umask.

## Exact source and remote checks

| Stage | Source | Evidence |
| --- | --- | --- |
| Initial website source | `f29e830e2d5fe701e014a5434af9e618707f630e` | Full local qualification passed; [Quality 40391928075](https://github.com/emseepea/emseepea/actions/runs/40391928075) found a trailing blank line and was later cancelled |
| Corrected website source | `f4f19c7220aaba59a2985ea9a299b258d0b9b1eb` | Full local qualification passed; [Quality 40394110659](https://github.com/emseepea/emseepea/actions/runs/40394110659) failed the Node 24 performance gate |

The corrected source passed 16 jobs, including Node 22, vulnerability policy,
documentation, all standalone initializers and website publication checks.
The Node 24 test suite completed, but its production performance budget failed;
release preparation was skipped. No release candidate, promotion, deployment
or merge-back exists for this website increment.

## Retained performance evidence

[Node 24 job 121823086539](https://github.com/emseepea/emseepea/actions/runs/40394110659/job/121823086539)
retained artifact `12685169419`, named
`benchmark-node-24.22.1-f4f19c7220aaba59a2985ea9a299b258d0b9b1eb-attempt-1`.

| Ordinary population | Accepted-request CPU p95 | Classification |
| --- | --- | --- |
| 1 | 3.522 ms | PASS |
| 2 | 3.023 ms | PASS |
| 3 | 6.179 ms | FLAG against the unchanged 5 ms ceiling |

All three populations and their cohorts are complete. Population 3 retains
600 accepted-request CPU samples, 33 above 5 ms. Throughput, allocation, wire
and the other request classes passed. Recomputing with the existing classifier
returns INCONCLUSIVE, `diagnosticOnly: false`, `qualifies: false`, with no
incomplete-evidence reason.

All three separately recorded diagnostic populations passed, but recomputation
returns `diagnosticOnly: true`, `qualifies: false`. They do not replace the
ordinary measurements. Independent architecture inspection found no evidenced
runtime or measurement defect in the retained evidence. Concurrent process work
is compatible with some samples; its cause remains unestablished. The passing
diagnostic profiles cannot identify the cause of the failing ordinary samples.

SHA-256 of retained files:

| File | SHA-256 |
| --- | --- |
| Downloaded artifact ZIP | `a5f7efa7b47aaed7f827ff67c58b7c931d17cb4fa67743f0c5cc2a5e76b26400` |
| `production-boundary.json` | `53d0f947bec77b14bb02c7b677cd0ca6e4b8537c1c8303330cb6333f6a051cd6` |
| `production-diagnostic.json` | `adabc50b8b3333a3ccf75093d1e9a60492bac3abb479f8e47b4b69e72c4d6301` |

The artifact was extracted to `/tmp/emseepea-website-node24-benchmark` for
inspection. The immutable workflow/artifact identifiers and observed results
above preserve the record if temporary local files disappear.

## Publication remains held

[R014](../risks/R014-performance-gate-misclassifies-a-revision-when-measurement-variance-is-unclassified.active.md)
requires all three complete ordinary populations to pass. A result-dependent
unchanged retry or diagnostic pass cannot qualify this source. No retry was
requested and no threshold, workflow, permission or runtime code was changed.

The six-file website source difference from the previous release contains no
runtime or dependency changes. The production-boundary benchmark does not enable
active request tracing. These facts limit attribution; they do not waive the
failed gate or establish performance equivalence.

The next unlock is an evidence-grounded correction or a separately assessed,
bounded investigation with a concrete unanswered question and useful decision
output. New exact-source qualification must then pass unchanged release gates.
Live-page, navigation, deployment and merge-back acceptance remain required.
The website increment is not Done; the previous server npm release stays complete.
