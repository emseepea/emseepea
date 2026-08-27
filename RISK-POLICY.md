# Risk Policy

ISO 31000-aligned project risk criteria

Last reviewed: 2026-08-28

## Business Context

Em See Pea is a pre-release, public, MIT-licensed TypeScript monorepo for a
general-purpose Model Context Protocol (MCP) Streamable HTTP server framework.
It includes examples, documentation, and future package releases.

Adopters use this source to build deployable servers. This project does not
operate a hosted service and makes no service-availability or service-level
objective (SLO) commitment.

Risk decisions cover:

- the public source repository
- protocol and security behaviour inherited by adopters
- accessibility of supplied user interfaces and documentation
- dependency and GitHub Actions supply chains
- honest capability claims
- release metadata and future npm publication integrity

Every committed artifact is treated as public.

## Risk Appetite

Threshold: 5

The maximum accepted cumulative residual risk for commit, push, or release is
5/25 (Low). Any layer above 5 must be remediated to within appetite or halted.
The appetite reflects an early pre-release framework with no operated service
while retaining a reachable path for severe-but-rare work whose controls reduce
likelihood to Rare.

The following risks can never be waived by a prompt or environment variable:

- licence infringement
- secret exposure
- destructive action without exact authority
- supply-chain compromise
- materially dishonest release or capability claims

Remove the risk, demonstrably control it to within appetite, or halt the action.

## Impact Levels

### 1 — Negligible

A cosmetic or internal editorial defect has no effect on builds, public APIs,
examples, accessibility, provenance, releases, or adopters.

### 2 — Minor

Developer-only friction interrupts a local build or tool. No released artifact,
adopter workflow, public trust, or confidential information is affected.

### 3 — Moderate

One or more of these consequences occurs:

- Public documentation, continuous integration, release-pull-request
  preparation, or update delivery is disrupted.
- Package or repository metadata materially misleads without creating an
  adopter security failure.
- Confidential business metrics are committed and require immediate removal.
  These include revenue, user counts, pricing, or traffic volumes.

### 4 — Significant

A public or released framework feature, example, user interface, or
documentation path is materially inaccessible, incompatible, misleading, or
insecure. Adopters' MCP servers or development workflows fail or lose an
expected protection.

### 5 — Severe

One or more of these consequences destroys adopter data integrity, safety,
legal reuse, or trust:

- a published supply-chain compromise
- credential or confidential-material disclosure
- licensing breach
- destructive or unauthorized framework behaviour
- exploitable protocol or security defect
- false conformance claim

## Likelihood Levels

- **1 — Rare:** Requires specific, unusual conditions. Extensive tests or
  architectural safeguards make occurrence very unlikely.
- **2 — Unlikely:** Could happen, but tests, continuous-integration gates,
  review hooks, or independent review significantly reduce probability.
- **3 — Possible:** Moderate complexity or limited test coverage means it could
  happen under normal conditions.
- **4 — Likely:** High complexity, many paths, or weak controls make occurrence
  expected without intervention.
- **5 — Almost certain:** A known gap, absent control, or previously observed
  failure mode makes occurrence expected.

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

This repository is intended to be public.

Do not commit:

- secrets, credentials, tokens, or private keys
- personal or customer data
- confidential client details
- incompatible third-party material
- non-public business metrics, including revenue, user counts, private pricing,
  and traffic volumes

These restrictions apply to files, history, issues, changesets, build output,
examples, and release notes.

Use generic descriptions and synthetic examples instead.

If disclosure is suspected, stop publication and follow the removal and
credential-rotation response.

## Authorized Bypass Scenarios

Only validated risk-reducing work can proceed through the reducing or incident
paths below. No prompt or environment variable can waive licensing,
secret-exposure, destructive-action, supply-chain, or honest-claim controls.

- Risk-reducing or risk-neutral changes proceed via the risk-reducing path. A
  change that lowers or holds residual risk is not blocked by the gate. The
  scorer emits `RISK_BYPASS: reducing`; the gate honours a drift-revalidated,
  time-to-live-bounded `reducing-*` marker. Drift revalidation proves the marker
  still describes the current change before its bounded validity expires.
- Incident response is not a separate appetite carve-out. An active incident is
  a risk already being realised at Likelihood 5, so an incident-response change
  is scored against that live baseline. It proceeds only when it reduces net
  risk. The `incident-release` marker permits only a net-risk-reducing
  restore-service release during an active outage, even when continuous
  integration is failing or unreadable.
- Above-appetite risk is never bypassable by a prompt or environment variable.
  There is no commit-or-release-anyway question and no `BYPASS_RISK_GATE` or
  `ci-bypass` override. Remediate above-appetite work to within appetite or halt
  it.
- Older policy that is silent about bypasses permits only the reducing and
  incident paths defined here. This section is the explicit source of truth.
- No bypass may waive licensing, secret-exposure, exact
  destructive-action authority, or honest release and capability-claim controls.

## Governance

The pipeline risk scorer and problem management process both use this policy as
the project's risk-criteria source. Review it after a material incident, before
enabling npm publication, when the supported MCP or Node.js surface changes
materially, or when business context changes.
