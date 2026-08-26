# Risk Policy

ISO 31000-aligned project risk criteria

Last reviewed: 2026-08-26

## Business Context

Em See Pea is a pre-release, public, MIT-licensed TypeScript monorepo for a
clean-room, general-purpose MCP Streamable HTTP server framework, its examples,
documentation, and future package releases. It is framework source for adopters
to build deployable servers; this project does not itself operate a hosted
service and makes no service-availability or operational-SLO commitment.

Risk decisions cover the public source repository, clean-room provenance,
protocol and security behaviour inherited by adopters, accessibility of supplied
user interfaces and documentation, dependency and GitHub Actions supply chains,
honest capability claims, release metadata, and future npm publication integrity.

Every committed artifact is treated as public. The project does not accept
restricted implementation material as implementation evidence.

## Risk Appetite

Threshold: 5

The maximum accepted cumulative residual risk for commit, push, or release is
5/25 (Low). Any layer above 5 must be remediated to within appetite or halted.
The appetite reflects an early pre-release framework with no operated service
while retaining a reachable path for severe-but-rare work whose controls reduce
likelihood to Rare.

Clean-room contamination, licence infringement, secret exposure, destructive
action without exact authority, supply-chain compromise, and materially
dishonest release or capability claims are never prompt-bypassable. They must be
removed, demonstrably controlled to within appetite, or the action halts.

## Impact Levels

| Value | Level | Business consequence |
|---:|---|---|
| 1 | Negligible | A cosmetic or internal editorial defect with no effect on builds, public APIs, examples, accessibility, provenance, releases, or adopters. |
| 2 | Minor | Developer-only friction such as a local build or tooling interruption; no released artifact, adopter workflow, public trust, or confidential information is affected. |
| 3 | Moderate | Public documentation, CI, release-PR preparation, or update delivery is disrupted; package or repository metadata materially misleads without creating an adopter security failure; or confidential business metrics such as revenue, user counts, pricing, or traffic volumes are committed and require immediate removal. |
| 4 | Significant | A public or released framework feature, example, UI, or documentation path is materially inaccessible, incompatible, misleading, or insecure, causing adopters' MCP servers or development workflows to fail or lose an expected protection. |
| 5 | Severe | A published supply-chain compromise, credential or restricted-material disclosure, clean-room or licensing breach, destructive or unauthorized framework behaviour, exploitable protocol/security defect, or false conformance claim destroys adopter data integrity, safety, legal reuse, or trust. |

## Likelihood Levels

| Value | Level | Description |
|---:|---|---|
| 1 | Rare | Requires specific, unusual conditions; extensive tests or architectural safeguards make occurrence very unlikely. |
| 2 | Unlikely | Could happen, but tests, CI gates, review hooks, or independent review significantly reduce probability. |
| 3 | Possible | Moderate complexity or limited test coverage means it could happen under normal conditions. |
| 4 | Likely | High complexity, many paths, or weak controls make occurrence expected without intervention. |
| 5 | Almost certain | A known gap, absent control, or previously observed failure mode makes occurrence expected. |

## Risk Matrix

Risk score is Impact x Likelihood.

| Impact / Likelihood | 1 Rare | 2 Unlikely | 3 Possible | 4 Likely | 5 Almost certain |
|---|---:|---:|---:|---:|---:|
| 1 Negligible | 1 | 2 | 3 | 4 | 5 |
| 2 Minor | 2 | 4 | 6 | 8 | 10 |
| 3 Moderate | 3 | 6 | 9 | 12 | 15 |
| 4 Significant | 4 | 8 | 12 | 16 | 20 |
| 5 Severe | 5 | 10 | 15 | 20 | 25 |

| Score | Label |
|---:|---|
| 1-2 | Very Low |
| 3-5 | Low |
| 6-9 | Medium |
| 10-16 | High |
| 17-25 | Very High |

## Confidential Information

This repository is intended to be public. Secrets, credentials, tokens, private
keys, personal or customer data, confidential client details, restricted
implementation material, and non-public business metrics must not appear in
committed files, history, issues, changesets, build output, examples, or release
notes. Confidential metrics include revenue, user counts, pricing not already
public, and traffic volumes. Use generic descriptions and synthetic examples
instead. Suspected disclosure requires stopping publication and following the
appropriate removal and credential-rotation response.

## Authorized Bypass Scenarios

- Risk-reducing or risk-neutral changes proceed via the risk-reducing path. A
  change that lowers or holds residual risk is not blocked by the gate. The
  scorer emits `RISK_BYPASS: reducing`; the gate honours a drift-revalidated,
  TTL-bounded `reducing-*` marker.
- Incident response is not a separate appetite carve-out. An active incident is
  a risk already being realised at Likelihood 5, so an incident-response change
  is scored against that live baseline and proceeds only when net-risk-reducing
  under ADR-042 Rule 1b. The `incident-release` marker exists only to let a
  net-reducing restore-service release proceed despite red or unreadable CI
  during a live outage.
- Above-appetite risk is never bypassable by a prompt or environment variable.
  There is no commit-or-release-anyway question and no `BYPASS_RISK_GATE` or
  `ci-bypass` override. Above appetite, the action is remediated to within
  appetite or halted under ADR-042 Rule 1.
- Default-permitted-when-silent: a policy predating this section still permits
  the risk-reducing and incident paths above; this section makes the policy the
  explicit single source of truth and should be added at its next review.
- No bypass may waive clean-room provenance, licensing, secret-exposure, exact
  destructive-action authority, or honest release and capability-claim controls.

## Governance

The pipeline risk scorer and problem management process both use this policy as
the project's risk-criteria source. Review it after a material incident, before
enabling npm publication, when the supported MCP or Node.js surface changes
materially, or when business context changes.
