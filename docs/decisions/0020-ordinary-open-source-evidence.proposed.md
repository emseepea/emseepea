---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0013", "ADR-0015"]
---

# Ordinary Open-Source Evidence

## Context and Problem Statement

Em See Pea needs ordinary open-source engineering and release evidence. A
repository-specific source-origin governance and qualification system adds
process and product narrative that the project does not need.

## Decision Drivers

- Product documentation should explain what the framework does.
- Release claims must remain exact, reproducible, and independently reviewable.
- Licensing, dependency integrity, and supply-chain provenance remain necessary.
- Bespoke certification and redundant provenance ledgers remain unnecessary.

## Considered Options

1. **Ordinary open-source evidence** - Use licences, locked dependencies,
   tests, reviews, checksums, SBOMs, and registry provenance without a separate
   source-origin governance regime.
2. **Retain the repository-specific governance** - Continue the existing
   controls, narrative, and qualification gate.
3. **Remove all evidence** - Publish without reproducible qualification or
   supply-chain records.

## Decision Outcome

Chosen option: **"Ordinary open-source evidence"**.

Remove the repository-specific product positioning, boundary document,
provenance regime, exposure workflow, and qualification gate. Do not replace
them under another name.

Retain normal open-source controls: MIT licensing; dependency manifests and the
locked registry integrity record; synthetic examples and tests; public-boundary
qualification from clean checkouts; exact capability and deployment claims;
independent technical reviews; checksums; software bills of materials; npm
trusted-publisher provenance; and standard contributor assurances that submitted
material may be licensed to the project.

No repository policy is created for archived projects. Any external instruction
not to inspect particular material remains outside this decision.

## Consequences

### Good

- Product and contributor documentation stays focused on the framework.
- Release evidence uses familiar ecosystem mechanisms.
- Duplicate governance and provenance records are removed.

### Neutral

- Historical superseded decisions remain immutable records.

### Bad

- The repository no longer makes or qualifies a source-origin claim.

## Confirmation

- Product and ordinary project documentation contains no source-origin claim or
  special qualification gate.
- Releases retain exact claims, independent reviews, checksums, SBOMs, registry
  provenance, dependency integrity, and clean-checkout qualification.
- Contributors attest only to ordinary rights, confidentiality, licensing, and
  quality requirements.
- No replacement source-origin governance or bespoke certification system is
  introduced.

## Pros and Cons of the Options

### Ordinary open-source evidence

- Good: Provides useful assurance with standard mechanisms.
- Bad: Does not support a source-origin qualification claim.

### Retain the repository-specific governance

- Good: Preserves the previous source-origin evidence structure.
- Bad: Adds unwanted process and product narrative.

### Remove all evidence

- Good: Has the fewest files.
- Bad: Makes release integrity and capability claims hard to trust.

## Reassessment Criteria

Reassess if a legal, licensing, or adopter requirement demands evidence not
provided by ordinary open-source and registry controls.
