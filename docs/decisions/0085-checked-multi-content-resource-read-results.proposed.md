---
status: "proposed"
date: 2026-09-13
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-13
---

# Checked Multi-Content Resource Read Results

> Captured with `/wr-architect:capture-adr`. The capturing agent derived the
> section content from the in-session decision context. Human oversight remains
> pending until ratification.

## Context and Problem Statement

Model Context Protocol (MCP) 2026-07-28 permits one `resources/read` result to
contain multiple text or blob contents. Their URIs may differ from the requested
URI, for example when a directory-like resource returns several files.

Em See Pea validates resource results with the installed MCP software
development kit (SDK) schema, but it also rejects every content whose URI
differs from the requested URI. That extra restriction excludes a standard
result shape. This decision determines how to admit multi-content resource
results without broadening discovery, access, or dereferencing authority.

## Decision Drivers

- Accept the complete MCP 2026-07-28 `ReadResourceResult` shape.
- Keep authentication and authorization attached to the requested capability.
- Preserve checked SDK validation, bounded results, cancellation, deadlines,
  and generic failure redaction.
- Avoid treating returned content URIs as registered or independently callable
  resources.
- Apply one rule to static resources and resource templates.
- Avoid unrelated catalogue mutation, sampling, retries, replay, persistence,
  or reconnect recovery.

## Considered Options

1. **Checked multi-content resource reads (chosen)**: accept multiple SDK-valid
   text or blob contents whose URIs may differ from the requested URI, without
   granting those URIs framework authority.
2. **Keep exact requested-URI equality**: continue rejecting every returned
   content whose URI differs from the request.
3. **Register returned URIs dynamically**: treat each returned content URI as a
   new resource that can later be read directly.

## Decision Outcome

Chosen option: **"Checked multi-content resource reads"**, because it admits
the standard result shape while preserving the requested resource as the sole
framework authority boundary.

Static-resource and resource-template handlers may return multiple installed-
SDK-valid text or blob contents. A returned content URI does not need to equal
the requested URI. The framework removes only that equality restriction.

Authentication, authorization, discovery suppression, and lifecycle checks
remain attached to the requested registered capability and finish before its
handler runs. Response-level cache instructions also remain attached to that
capability and apply to the complete multi-content response, not independently
to each returned URI.

Returned content URIs carry client-facing identity only. They do not register a
resource, make it directly callable, grant authorization, or cause server-side
dereferencing. Unknown direct resource reads retain their existing safe error.

The existing installed-SDK schema validation and schema-produced copying,
generic failure redaction, cancellation, deadlines, whole-result byte limits,
cache instructions, and unknown-resource handling remain in force. This
increment does not add the framework's separate safe-JSON copy or deep-freeze
boundary to resource results.

## Consequences

### Good

- Directory-like and aggregate resources can return several standard contents.
- Static resources and resource templates share the same result rule.
- The framework removes a restriction without adding runtime state or a new
  public abstraction.
- Existing access and result-safety boundaries remain unchanged.

### Neutral

- One response-level cache instruction covers the whole returned collection.
- Clients may receive content URIs that are not independently readable through
  this server.

### Bad

- Applications must avoid implying that a returned URI is directly callable
  when it is only an identity inside the aggregate result.
- One authorized read can disclose several contents, so application handlers
  remain responsible for returning only data authorized through the requested
  capability.

## Confirmation

- Static-resource and resource-template handlers can each return multiple text
  and blob contents with URIs different from the requested URI.
- The official MCP client pinned to `2026-07-28` receives every content intact.
- Protected reads authenticate and authorize the requested capability before
  the handler runs.
- A returned URI gains no listing entry or direct-read authority.
- SDK-invalid and oversized results retain the generic safe resource error.
- Cancellation, deadlines, cache instructions, discovery suppression, and
  existing unknown-resource behavior remain unchanged.
- Legacy clients preserve their documented resource-read behavior.
- Source, type, black-box, packed-package, and benchmark checks pass from clean
  checkouts, with the measured benchmark inside ADR-0014's budget.
- A released-package journey exercises both static and template multi-content
  reads, separately from publication and registry-integrity evidence.
- Registry readback verifies the released package version, integrity,
  signatures, provenance, and public types.
- Protocol coverage and package guidance document the authority and cache
  boundaries.

## Pros and Cons of the Options

### Checked Multi-Content Resource Reads

- Good, because it admits the standard response without adding a mutation or
  registration mechanism.
- Bad, because returned URIs can look callable even when they are not.

### Keep Exact Requested-URI Equality

- Good, because every returned content identity remains identical to the
  requested capability.
- Bad, because it rejects valid MCP aggregate and directory-like results.

### Register Returned URIs Dynamically

- Good, because every returned URI could become directly readable.
- Bad, because it would add mutable catalogue state and new authorization rules
  contrary to ADR-0080's immutable deployment model.

## Performance Review

Source: **no data - worst-case assumption**.

At 100 `resources/read` requests per second, removing the URI-equality scan is
expected to add 0 bytes of framework allocation, 0 bytes of framework-added
network output, and between -0.05 ms and 0 ms CPU per request. The aggregate
delta is therefore 0 bytes per second of allocation, 0 bytes per second of
framework-added network output, and between -5 ms and 0 ms CPU per second. The
existing one-mebibyte result ceiling leaves the application-selected payload
ceiling unchanged at 100 MiB per second.

The planning verdict is **PASS** against ADR-0014. A measured benchmark must
still pass before release.

## Reassessment Criteria

Reassess if MCP changes `ReadResourceResult` URI semantics, Em See Pea adopts a
policy that makes returned URIs independently dereferenceable, or measured
validation cannot meet ADR-0014's budget. Any reassessment must preserve
authorization before handler execution, generic failure redaction, explicit
whole-result limits, and truthful resource discovery.
