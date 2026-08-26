---
status: "proposed"
date: 2026-08-27
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Ordinary Evidence and Exact Release Claims

## Context and Problem Statement

The guide combines strong qualification ideas with a bespoke cryptographic
certification system. Em See Pea needs reproducible evidence for exact release
claims, but it is not a certification or trust-root product.

## Decision Drivers

- Claims must be independently reproducible through public boundaries.
- Evidence integrity should use maintained release and supply-chain tools.
- Qualification must include negative, disabled, security, and accessibility paths.
- Custom signing governance would add risk without improving framework behavior.

## Considered Options

1. **Ordinary reproducible evidence and exact claims** - Use real HTTP tests,
   independent clients, clean CI, traceability, checksums, SBOMs, and reviews.
2. **Bespoke cryptographic certification** - Build signer keys, challenges,
   trust roots, signature graphs, attestations, and report validators.
3. **Dependency tests only** - Treat official SDK success as framework qualification.

## Decision Outcome

Chosen option: **"Ordinary reproducible evidence and exact claims"**.

Each release claim names the exact protocol modules, access policy, deployment
topology, state guarantees, and exclusions proven by current evidence. Evidence
uses raw real-HTTP tests, at least two independent clients for a full claim,
clean checkouts, synthetic services and materially different adapters,
requirement-to-test traceability, locked dependencies, registry integrity,
checksums, software bills of materials, CI artifacts, and independent protocol,
security, accessibility, architecture, and clean-room reviews.

A full active server-surface claim is available only when every active in-scope
requirement has current passing evidence. Until then releases use composable
partial claims. The guide's custom signer keys, single-use verifier challenges,
trust roots, signature graphs, evidence envelopes, revocation registry,
attestation protocol, paired reports, and cryptographic report validator are
explicitly rejected. Ordinary artifact digests and supply-chain signatures may
be used through maintained release tooling; they do not create a new
certification protocol.

## Consequences

### Good

- Evidence tests framework behavior rather than a new governance product.
- Claims remain understandable and independently repeatable.
- Standard supply-chain controls are retained.

### Neutral

- A full claim may arrive well after useful partial releases.

### Bad

- There is no bespoke cryptographic chain connecting every historical report.

## Confirmation

- Every public claim maps to current tests and named clean-checkout artifacts.
- Raw HTTP negative tests prove invalid and security failures cause zero application calls.
- Independent clients and synthetic services exercise only the public package boundary.
- Checksums, SBOMs, locked dependencies, and independent reviews accompany release evidence.
- No custom certification key, challenge, trust-root, attestation, or report-validation subsystem exists.

## Pros and Cons of the Options

### Ordinary reproducible evidence and exact claims

- Good: Uses established tools and tests the actual product.
- Bad: Requires disciplined traceability and review.

### Bespoke cryptographic certification

- Good: Could create tamper-evident evidence relationships.
- Bad: Is a second product with substantial key and governance risk.

### Dependency tests only

- Good: Is very small.
- Bad: Does not qualify Em See Pea's own boundary or policies.

## Reassessment Criteria

Reassess when a real adopter or regulator requires a specific standard
attestation that ordinary reproducible evidence cannot provide.
