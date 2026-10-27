# Website tracing release evidence

Date: 2026-10-27, Australia/Sydney.
Status: **RELEASED AND VERIFIED**.

The [Trace requests guide](https://emseepea.github.io/emseepea/tracing/) is live
on the existing Em See Pea website. It meets the website content and
navigation result in [increment #192](https://github.com/emseepea/emseepea/issues/192),
within [outcome #186](https://github.com/emseepea/emseepea/issues/186).
The deadline remains Wednesday afternoon, 28 October, Australia/Sydney.
All required repository qualification stages below completed successfully.
Increment #192 owns the independent final acceptance and delivery record.

## Exact release chain

| Stage | Revision | Evidence |
| --- | --- | --- |
| Website source | `f4f19c7220aaba59a2985ea9a299b258d0b9b1eb` | Full local exact-commit qualification; [Quality 40394110659, attempt 2](https://github.com/emseepea/emseepea/actions/runs/40394110659/attempts/2) SUCCESS |
| Frozen candidate | `706136665e87131fbf40fbd672409777e71916c7` | Generated-tree/source check PASS; [Release 40450852566](https://github.com/emseepea/emseepea/actions/runs/40450852566) SUCCESS |
| Generated prose review | `442c5721fe397d4383521d062ce9876239ef4f3e` | [Documentation Quality 40451187679](https://github.com/emseepea/emseepea/actions/runs/40451187679) SUCCESS |
| Promotion/deployment merge | `0590d8df28712731259f39a4e73b5f104ff2464b` | [PR #194](https://github.com/emseepea/emseepea/pull/194) merged; [Publish 40452523342](https://github.com/emseepea/emseepea/actions/runs/40452523342) SUCCESS, including website deployment and merge-back |
| Merge-back to main | `cc77656c131aec153ed4f3f5f429b4f614b46329` | [Quality 40452750748](https://github.com/emseepea/emseepea/actions/runs/40452750748) SUCCESS |

The candidate origin binds source `f4f19c7` and Quality run 40394110659.
The complete generated diff contains only the private website version,
changelog, lockfile metadata, release origin and consumed Changeset. Changesets
generated website version 0.0.14. No new public npm package is published.

The existing exact-head `release:watch` path revalidated the candidate and
merged it. Publish deployed the artifact measured by source Quality, without
rebuilding it. Source artifact `12709419226`, named `github-pages`, has digest
`sha256:fc5b8bd56d2b86365fb15525e5571a2eb771aec638d55bc710112fff8debe120`.

The merge-back has exact parents `442c5721fe397d4383521d062ce9876239ef4f3e`
and `0590d8df28712731259f39a4e73b5f104ff2464b`. Its full qualification and the
overall Publish workflow completed successfully.

## Live and installed-guide verification

The live guide returned HTTP 200 with the expected title and canonical URL.
The home/sidebar link and the observability explanation's link inside the main
content both reached it without JavaScript. Copyable JavaScript matches the
executed source exactly; the displayed code also matches after accounting for
the renderer's line elements.

Example JavaScript SHA-256:
`9a8db68b5938141602dba41147914e69f02e247dfcff3ef6d163a8ad61bc6481`.

The same example was executed verbatim in a fresh project outside the checkout
against registry-installed server 0.25.1. It returned HTTP 200, exported incoming
parent → MCP request → backend child in one trace, and flushed on graceful
shutdown. The earlier [publication checkpoint](website-tracing-publication-2026-10-26.md)
retains the observed span IDs. The example uses a synthetic backend and console
exporter, not an operated production telemetry service.

The website build and all 16 existing local website checks passed, including
accessibility, mobile/desktop and light/dark output. Exact-source CI also passed
website measurements, both supported Node runtimes, vulnerability policy and
all standalone initializers. Source and generated prose received independent
cognitive review.

Temporary live-check evidence was captured in
`/tmp/emseepea-website-live-receipt.json` and
`/tmp/emseepea-verify-live-tracing.py`. The live URL, observed results and code
hash above preserve the record if those temporary files disappear.

## Original result and scoped retry exception

[Quality attempt 1](https://github.com/emseepea/emseepea/actions/runs/40394110659/attempts/1)
remains a failed qualification. Its three complete ordinary accepted-request
populations measured CPU p95 of 3.522, 3.023 and 6.179 ms against the unchanged
5 ms ceiling. The mixed result is INCONCLUSIVE; passing diagnostic populations
do not qualify. The original artifact and hashes remain recorded in the
26 October checkpoint.

After the renewed user instruction to push and release, increment revision 2 /
outcome plan revision 4 selected one controlled whole-workflow retry, reviewed
independently by architecture, jobs, risk, cognitive-accessibility and planning
critics. This is an explicit website-specific exception to the local R014
anti-resampling guidance. The user did not literally name an R014 waiver.

Attempt 2 ran the complete existing workflow at the same source SHA and all
18 jobs passed. No threshold, sample count, population rule, runtime, dependency,
workflow or permission changed. The earlier failed result is not invalidated;
no cause, runtime performance equivalence or global R014 re-rating is claimed.
The release scope is the private website, with unchanged public framework
packages. Independent risk assessment placed this scoped action at 5/25,
conditional on the existing required release checks.

All required source, release, website deployment and exact merge-back checks
completed successfully. Independent acceptance is owned by increment #192. No
further runtime feature or speculative investigation is part of this release.
