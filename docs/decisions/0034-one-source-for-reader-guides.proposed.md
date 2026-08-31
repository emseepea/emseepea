---
status: "proposed"
date: 2026-08-31
human-oversight: confirmed
oversight-date: 2026-08-31
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-30
---

# One Source for Reader Guides

## Context and Problem Statement

Copies of the same guide or code snippet can disagree. Readers need one
maintained source for each instruction.

## Decision Drivers

- Avoid duplicated instructions.
- Keep README entry points short and useful.

## Considered Options

1. **One guide source** - Keep full reader guides in the website content tree.
2. **Maintain copies** - Keep full guides in both website pages and READMEs.

## Decision Outcome

Chosen option: **"One guide source"**, because it avoids inconsistent copies.

Keep reader-facing guides in `website/src/content/docs`. Root, package, and
example READMEs remain short entry points linking to the relevant guide.
Governance records may remain in `docs` outside the main reader journey.

Each runnable snippet appears once: as a marked guide block or a link to its
canonical source file. Do not maintain unchecked copies.

## Consequences

### Good

- One edit updates the maintained instruction.

### Neutral

- Some existing reader guidance moves into website content.

### Bad

- README readers may need to follow a link for detailed guidance.

## Confirmation

- Each guide has one maintained source, with descriptive README links.
- Runnable snippets have one source rather than separately edited copies.
- Governance records do not displace getting-started guidance.

## Pros and Cons of the Options

### One guide source

- Good: Reduces drift.
- Bad: Requires maintained entry-point links.

### Maintain copies

- Good: Full guides remain in each location.
- Bad: Copies can become inconsistent.

## Reassessment Criteria

Revisit if a supported offline or packaging requirement needs generated copies.

## Related Decisions

- [verified guides before website publication](0035-verified-guides-before-website-publication.proposed.md)
