---
status: "proposed"
date: 2026-09-04
human-oversight: confirmed
oversight-date: 2026-09-04
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-04
supersedes: ["0043-single-full-initializer-qualification-per-ci-event"]
---

# Quality-Gated Exact-Commit Release Continuation

## Context and Problem Statement

Every push to `main` starts Quality and Release independently. Both workflows
repeat the Node.js 22 and 24 suites and standalone initializer qualification
for the same commit. Release then verifies eight published initializers
sequentially. The duplication consumes runner time and extends the release
critical path without producing distinct evidence.

## Decision Drivers

- Treat `main` as untrusted until the pipeline qualifies the exact commit.
- Preserve every release, semantic, accessibility, performance, load, audit, provenance, and package verification gate.
- Reuse successful evidence instead of repeating it for the same SHA.
- Reduce wall time for initializer verification and bound registry delays.
- Fail closed when upstream evidence is missing, unsuccessful, or belongs to another commit.

## Considered Options

1. **Quality-gated release continuation** - Run complete exact-SHA qualification in Quality, then start Release only from that successful result.
2. **Independent duplicate workflows** - Keep repeating compatibility and initializer qualification in both workflows.
3. **One combined workflow** - Merge Quality and Release into one large workflow with publication permissions.

## Decision Outcome

Chosen option: **"Quality-gated release continuation"**, because Quality can
remain the unprivileged trust gate for untrusted `main`, while Release can
reuse its exact-SHA evidence and retain only checks that must occur at release
time.

Quality continues to qualify Node.js 22 and 24, audits, performance, load,
accessibility, the website, and all standalone initializers. Release triggers
only from a successful Quality `workflow_run` for a push to `main`, checks out
`github.event.workflow_run.head_sha`, and records the upstream run and SHA in
release evidence. Live Claude evaluation remains once in Release before
publication.

Registry verification, SBOMs, integrity, signatures, provenance, clean
installation, documentation journeys, and tag equality remain release gates.
The eight post-publication initializer journeys use four bounded workers with
isolated destinations and fail-closed error propagation. npm audit network
timeouts and retries are bounded without converting failure into success.
Benchmarks may reuse output built earlier in the same successful job.

## Consequences

### Good

- Node matrix and standalone initializer qualification run once per pushed SHA.
- Release cannot begin until the exact commit passes the unprivileged Quality trust gate.
- Post-publication initializer wall time falls through bounded concurrency.
- Registry stalls have explicit bounds and remain failures.

### Neutral

- Release starts after Quality rather than at the same time.
- Quality becomes the source of prepublication qualification evidence for Release.

### Bad

- A failed or cancelled Quality run prevents Release from starting.
- Workflow-run event handling must reject pull requests, other branches, other repositories, and mismatched SHAs.
- Re-running Quality can create another Release attempt for the same SHA, so existing idempotent registry and tag checks remain necessary.

## Confirmation

- Quality runs on pushes to `main` and retains Node.js 22 and 24, audit, performance, load, accessibility, website, and initializer checks.
- Release triggers only from a successful Quality `workflow_run` whose event is `push`, branch is `main`, repository is `emseepea/emseepea`, and head SHA is present.
- Every Release checkout and evidence-producing command uses the upstream Quality head SHA.
- Release evidence records the upstream Quality run URL and exact SHA.
- Live Claude evaluation runs once in Release before publication.
- Release does not repeat the Node compatibility matrix or prepublication initializer qualification.
- Eight registry initializer journeys run with four bounded workers and propagate every failure.
- Audit retry and timeout bounds remain fail closed.
- `benchmark:built` runs only after the same job successfully builds and tests the revision.
- Publication still requires exact-SHA provenance, registry readback, SBOMs, signatures, clean installation, semantic checks, and tag equality.
- `npm run push:watch` waits for Quality before discovering Release and fails promptly when Quality fails.

## Pros and Cons of the Options

### Quality-gated release continuation

- Good: Separates unprivileged qualification from privileged publication while reusing exact-SHA evidence.
- Bad: Requires careful `workflow_run` validation and evidence binding.

### Independent duplicate workflows

- Good: Each workflow carries all of its own prepublication evidence.
- Bad: Repeats the slowest checks for the same commit and delays publication.

### One combined workflow

- Good: Makes dependencies visible in one workflow graph.
- Bad: Places untrusted qualification and publication permissions in one workflow and creates a larger privileged surface.

## Reassessment Criteria

Revisit this decision if GitHub changes `workflow_run` security semantics,
Quality no longer contains the complete prepublication gate set, release
attempt duplication becomes operationally significant, or a native reusable
evidence mechanism can bind both workflows to one SHA with less code.

## Related Decisions

- [exact-commit trunk push and pipeline watch](0044-exact-commit-trunk-push-and-pipeline-watch.proposed.md)
- [public pre-alpha releases through npm Trusted Publishing](0019-public-pre-alpha-releases-through-npm-trusted-publishing.superseded.md)
