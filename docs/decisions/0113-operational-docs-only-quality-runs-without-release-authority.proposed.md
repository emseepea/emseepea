---
status: "proposed"
date: 2026-10-07
human-oversight: confirmed
oversight-date: 2026-10-07
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2027-01-07
---

# Operational Docs-Only Quality Runs Without Release Authority

> Captured via /wr-architect:capture-adr. Substance was derived from the
> session's decision context and awaits human ratification.

## Context and Problem Statement

Tom requested that GitHub also avoid the full application and container checks
for documentation-only commits. A successful Quality run is currently used as
release evidence, so a reduced documentation run must not be mistaken for full
software qualification.

## Decision Drivers

- Reduce GitHub execution for operational prose that changes no software input.
- Check the complete tested event range, not just its last commit.
- Keep mixed, unknown, and software-affecting changes on the full route.
- Preserve full software qualification as a prerequisite for publication.

## Considered Options

1. **Docs-only Quality without release authority**: run documentation checks
   for strictly eligible ranges and retain full checks for all other ranges.
2. **Full Quality for every commit**: keep the existing workflow unchanged.

## Decision Outcome

Chosen option: **"Docs-only Quality without release authority"**, because
operational Markdown needs checked prose, not a running application, while
software releases still need every existing qualification prerequisite.

Quality uses the same narrow classifier as local push qualification. It checks
the complete push-before-to-head or pull-request-base-to-tested-head range.
Only regular Markdown files under briefing, problems, retrospectives, and
reviews are eligible. Unknown, empty, non-ancestor, or mixed ranges receive
full checks.

Documentation review runs on every event. Eligible documentation runs omit
runtime, initializer, website, and dependency-scan jobs, and cannot prepare or
authorize a release. Full runs retain those jobs. Release verification checks
the exact source, originating Quality run, and successful full prerequisite
jobs from its current attempt before publication. The trunk watcher continues
to wait for the exact commit's complete Quality workflow.

This scopes Quality execution without changing the publish-branch process,
package generation, release content, or merge protection.

## Consequences

### Good

- Operational documentation uses no GitHub container, build, or dependency scan.
- Every event still checks content-bound prose-review evidence.
- Reduced Quality success cannot stand in for software-release qualification.

### Neutral

- Full software qualification remains unchanged for all other paths.
- Local qualification remains the separate decision in ADR-0112.

### Bad

- Event-base resolution and conditional jobs introduce a small maintained boundary.
- Release verification must reject missing, skipped, ambiguous, or stale job evidence.

## Confirmation

- Real operational-documentation pushes complete exact-commit Quality with only
  classification and documentation checks.
- Real mixed changes still run every full prerequisite.
- Reduced Quality success cannot publish packages or generate a release candidate.
- Behavioural checks reject missing or skipped prerequisites, stale attempts,
  wrong sources, and incomplete job pagination.

No actual production-use confirmation has been recorded at capture.

## Pros and Cons of the Options

### Docs-Only Quality Without Release Authority

- Good: avoids unrelated application work for eligible prose changes.
- Bad: requires a conservative classifier and explicit release-evidence checks.

### Full Quality for Every Commit

- Good: keeps one execution path.
- Bad: spends runtime and container capacity on operational documentation.

## Reassessment Criteria

Reassess if eligible prose becomes a software input, classification admits a
mixed change, or conditional execution obscures the evidence needed to release.
