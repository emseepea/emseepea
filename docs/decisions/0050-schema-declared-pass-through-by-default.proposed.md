---
status: "proposed"
date: 2026-09-05
human-oversight: confirmed
oversight-date: 2026-09-05
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-05
---

# Schema-Declared Pass-Through by Default

> Tom Howard approved the pass-through-by-default principle and requested its
> implementation on 2026-09-05.

## Context and Problem Statement

An MCP server sits between a language model and a backend. Replacing useful
backend values with a second MCP-owned vocabulary can force a framework release
whenever the backend adds a valid value. It also adds code and drift without
necessarily helping the model. Em See Pea needs a mapping rule that keeps MCP
integrations light while retaining explicit public schemas and checked trust
boundaries.

## Decision Drivers

- Let compatible backend value additions reach callers without an MCP release.
- Give language models clear names, descriptions, and bounded data.
- Keep public fields deliberate and exclude private backend data.
- Preserve separate validation at public and backend boundaries.
- Avoid translation tables that duplicate an evolving backend vocabulary.
- Keep mapping available for real transport, safety, and comprehension needs.

## Considered Options

1. **Schema-declared pass-through by default with explicit exceptions**: select
   public-safe fields explicitly, but preserve their useful backend concepts and
   values unless mapping has a concrete reason.
2. **Semantic normalization by default**: translate backend names and values
   into an MCP-owned vocabulary at every boundary.
3. **Raw backend payload pass-through**: return validated backend payloads
   without a separate public field selection.

## Decision Outcome

Chosen option: **"Schema-declared pass-through by default with explicit
exceptions"**, because it lets compatible backend values evolve without
duplicating their catalogue while keeping the public contract deliberate and
safe.

Public schemas continue to select and validate every emitted field. For a
selected field, the MCP preserves the backend's useful concept and value by
default. A closed enum is used only when the MCP owns the finite vocabulary or
when protocol, safety, or backend constraints require it.

Mapping remains appropriate for transport compatibility, security, redaction,
aggregation, or genuine model comprehension. These exceptions should be clear
from the code or accompanying documentation. Unknown fields, credentials,
destinations, private errors, and unvalidated values are never passed through.
Backend and public validation remain separate even when their selected values
have the same representation.

## Consequences

### Good

- New structurally valid backend values can pass through without an MCP release.
- Examples contain less translation code and fewer duplicated catalogues.
- Language models receive values that match the system they are operating.
- Explicit public schemas continue to prevent accidental backend disclosure.

### Neutral

- Some field names and values remain provider-specific when they are already
  clear and useful to a model.
- A new backend field still requires deliberate public-contract review.

### Bad

- Provider vocabulary changes can be visible to callers.
- Reviewers must distinguish genuine model clarification from cosmetic
  normalization.

## Confirmation

- A test proves that a previously unseen but structurally valid value in an
  approved backend field reaches public structured output unchanged.
- Malformed backend values and undeclared backend fields cannot reach public
  output.
- Translation in maintained examples is limited to transport compatibility,
  security, redaction, aggregation, or genuine model comprehension.
- Public and backend schemas remain separately declared and checked.
- Framework guidance tells adopters to use direct tools for identity mappings
  and pass-through mapping for selected compatible values.

## Pros and Cons of the Options

### Schema-declared pass-through by default with explicit exceptions

- Good: Supports backend evolution with minimal mapping code.
- Bad: Exposes provider vocabulary when it is part of the useful contract.

### Semantic normalization by default

- Good: Gives the MCP complete control over its vocabulary.
- Bad: Duplicates backend catalogues and turns compatible value additions into
  MCP release work.

### Raw backend payload pass-through

- Good: Requires the least transformation code.
- Bad: Can expose private or irrelevant fields and removes deliberate public
  contract selection.

## Reassessment Criteria

Reassess if language-model qualification shows that provider vocabulary causes
material tool-use errors, a backend cannot offer stable value shapes, or a
protocol or security requirement needs a closed MCP-owned vocabulary.
