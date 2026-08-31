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

# Measured Website Performance Before Publication

## Context and Problem Statement

The framework's JSON HTTP budget does not describe website performance. We
need website measurements before setting credible publication limits.

## Decision Drivers

- Use measured rather than invented limits.
- Do not publish the site without an approved performance budget.

## Considered Options

1. **Measure, then approve a budget** - Base website limits on the first build.
2. **Reuse the server budget** - Apply unrelated JSON-boundary limits.
3. **Publish without a budget** - Have no agreed website performance limit.

## Decision Outcome

Chosen option: **"Measure, then approve a budget"**, because website limits need website evidence.

Measure compressed HTML, CSS, JavaScript, browser processing time, and memory
from the first website build. Include the local search index and its browser work.

Use that evidence to propose a separate numerical website performance budget.
Public deployment waits for its ratification and passing measurements. This
record approves that process, **not any numerical limit or a website release**.
Do not claim measured performance before evidence exists.

## Consequences

### Good

- Limits reflect the website readers will actually use.

### Neutral

- The first build supplies evidence for a later numerical decision.

### Bad

- Public deployment must wait for budget approval and a passing check.

## Confirmation

- Measurements identify the tested website build and measurement conditions.
- All named resource, processing, and memory measurements are recorded.
- A separate numerical budget is ratified before public deployment.
- The selected publication build passes that budget.

## Pros and Cons of the Options

### Measure, then approve a budget

- Good: Grounds limits in evidence.
- Bad: Requires a later budget decision.

### Reuse the server budget

- Good: Avoids a new budget.
- Bad: Measures the wrong workload.

### Publish without a budget

- Good: No budget approval step.
- Bad: Provides no agreed performance guardrail.

## Reassessment Criteria

Revisit measurement conditions when the site's content or runtime behavior
changes materially.

## Related Decisions

- [performance budget initial json http boundary](0014-performance-budget-initial-json-http-boundary.proposed.md)
- [local website search](0037-local-website-search.proposed.md)
