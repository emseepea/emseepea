---
status: "proposed"
date: 2026-09-12
human-oversight: confirmed
oversight-date: 2026-09-12
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-12
---

# Application-Owned Model Provider Integration Instead of Deprecated MCP Sampling

## Context and Problem Statement

MCP 2026-07-28 retains `sampling/createMessage`, which lets a server ask a
capable client to perform an LLM generation through an `input_required`
round trip. The client chooses the model, controls its credentials, and should
let a person review the request and response.

The same protocol version deprecates Sampling, says new implementations should
not adopt it, and directs existing implementations toward model-provider APIs.
Em See Pea does not currently expose a sampling request helper or response
accessor, and its checked input-request boundary accepts only elicitation and
client roots.

This decision determines whether Em See Pea should add server-side support for
the deprecated Sampling feature.

## Decision Drivers

- Follow the active protocol's direction for new implementations.
- Avoid adding public API and validation for a feature already scheduled for removal.
- Keep model credentials, selection, cost controls, and approval flows owned by applications.
- Preserve the existing checked boundary for multi-round-trip input.
- Add protocol surface only when a demonstrated compatibility need justifies it.

## Considered Options

1. **Application-owned model-provider integration without MCP Sampling**:
   intentionally leave `sampling/createMessage` unsupported and direct
   applications needing model calls to provider APIs.
2. **Basic opt-in MCP Sampling**: support text, audio, and image generation,
   but exclude sampling tools and deprecated context inclusion.
3. **Full MCP Sampling**: support generation, sampling-scoped tools, tool loops,
   and negotiated context inclusion.

## Decision Outcome

Chosen option: **"Application-owned model-provider integration without MCP
Sampling"**, because MCP 2026-07-28 tells new implementations not to adopt the
deprecated feature and no demonstrated Em See Pea compatibility need outweighs
that direction.

Em See Pea will not expose a `sampling/createMessage` helper, response accessor,
or accepted client-input request type. A forged sampling input request remains
invalid at the existing checked multi-round-trip boundary. Server applications
that need model generation integrate directly with their chosen provider and
own the associated credentials, model selection, cost controls, user approval,
and data-disclosure policy.

This decision adds no Sampling capability negotiation, model routing, approval
interface, tool loop, context inclusion, dependency, retry, replay, persistence,
or reconnect recovery.

## Consequences

### Good

- Em See Pea follows the protocol's migration direction instead of growing a retiring API.
- The framework adds no model-provider abstraction, credentials, or approval workflow.
- Existing checked input-request validation remains narrow and explicit.

### Neutral

- Model generation remains possible in application code through provider APIs.
- Different applications may choose different providers and approval controls.
- Sampling remains present but deprecated in MCP 2026-07-28.

### Bad

- Clients and servers that require MCP Sampling cannot use Em See Pea for that interaction.
- Applications needing model calls must integrate with a provider directly.

## Confirmation

- Public framework types expose no Sampling request helper, response accessor, or accepted input-request type.
- A hand-built `sampling/createMessage` input request is rejected before delivery or continuation work.
- Modern and legacy discovery remain unchanged and advertise no Sampling support.
- Protocol coverage and published framework guidance identify Sampling as intentionally unsupported and recommend model-provider APIs.
- Source, type, black-box, packed-package, and released-package checks preserve the same rejection boundary.
- Registry verification confirms that the released package exposes neither Sampling types nor runtime behavior.

## Pros and Cons of the Options

### Application-Owned Model-Provider Integration Without MCP Sampling

- Good: Follows the deprecation guidance and adds no framework surface.
- Bad: Does not provide compatibility for clients that still depend on MCP Sampling.

### Basic Opt-In MCP Sampling

- Good: Provides bounded compatibility without a tool loop or deprecated context inclusion.
- Bad: Adds public API, validation, approval responsibilities, and release burden for a deprecated feature.

### Full MCP Sampling

- Good: Provides the widest compatibility with existing Sampling clients.
- Bad: Adds the largest security, validation, approval, and maintenance surface for a feature scheduled for removal.

## Performance Review

No runtime behavior is added, so this decision introduces no new runtime
performance budget or claim.

## Reassessment Criteria

Reassess if a demonstrated application or interoperability requirement depends
on MCP Sampling, the protocol reverses the deprecation, or a replacement MCP
mechanism is standardized. Removal of Sampling from the protocol does not
require reassessment because the chosen boundary already omits it.
