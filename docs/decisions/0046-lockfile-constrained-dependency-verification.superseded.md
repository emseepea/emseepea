---
status: "proposed"
date: 2026-09-04
human-oversight: confirmed
oversight-date: 2026-09-04
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-04
supersedes: ["ADR-0045"]
---

# Lockfile-Constrained Dependency Verification

## Context and Problem Statement

The npm advisory endpoint repeatedly timed out while package installation and
all repository checks remained available. Because Quality treated that remote
endpoint as mandatory, the outage prevented initializer qualification and
release for an otherwise unchanged dependency graph.

## Decision Drivers

- Keep dependency verification deterministic and bound to the exact commit.
- Do not let an unavailable advisory service block all qualification.
- Retain checks for package integrity, signatures, provenance, and standalone installs.
- Use the existing lockfile and packed-consumer graph checks.

## Considered Options

1. **Lockfile-constrained verification** - Remove vulnerability advisory calls while retaining lockfile graph and package authenticity checks.
2. **Fail-closed remote advisory** - Continue requiring the npm advisory endpoint for Quality and release.

## Decision Outcome

Chosen option: **"Lockfile-constrained verification"**, because the committed
lockfile and existing packed-consumer checks provide deterministic dependency
evidence without depending on the unavailable advisory service. Published
packages still require registry integrity, signatures, provenance, and clean
installation verification.

## Consequences

### Good

- Advisory service outages no longer block unrelated qualification and release work.
- Dependency graph evidence remains reproducible for the exact commit.
- No replacement advisory client or new dependency is introduced.

### Neutral

- Vulnerability advisory review is no longer an automated release gate.
- npm package signature verification remains a release-time network check.

### Bad

- Newly reported vulnerabilities are not detected by this pipeline.
- Maintainers must use another review path when vulnerability intelligence is needed.

## Confirmation

- Quality contains no npm vulnerability advisory call.
- Release contains no npm vulnerability advisory call.
- Packed consumers must use third-party versions present in the committed root lockfile.
- Registry verification retains integrity, provenance, signature, and clean-install checks.
- Quality and Release remain bound to the same exact commit.

## Pros and Cons of the Options

### Lockfile-constrained verification

- Good: Deterministic checks cannot be disabled by an unrelated advisory outage.
- Bad: The pipeline does not automatically detect newly disclosed vulnerabilities.

### Fail-closed remote advisory

- Good: High-severity advisories block publication automatically.
- Bad: Endpoint availability controls the entire release path.

## Reassessment Criteria

Revisit this decision if npm provides a reliable bounded advisory service, a
maintained repository-native security scanner is adopted, or the lockfile graph
check no longer covers every generated consumer dependency.

## Related Decisions

- [quality-gated exact-commit release continuation](0045-quality-gated-exact-commit-release-continuation.superseded.md)
