---
status: "proposed"
date: 2026-09-13
human-oversight: confirmed
oversight-date: 2026-09-13
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-13
---

# Checked Multi-Content Resource Read Results

> Captured with `/wr-architect:capture-adr`. The capturing agent derived the
> section content from the in-session decision context. Human oversight remains
> pending until ratification.

## Plain English Summary

When a client asks to read one resource, Model Context Protocol (MCP) allows the
server to answer with several pieces of content. For example, reading a
folder-like resource may return several files.

Em See Pea should allow that response shape. One authorized Em See Pea read can
return many content items. Their URIs identify those items but do not create
readable Em See Pea resources.

## Context and Problem Statement

Model Context Protocol (MCP) 2026-07-28 allows one `resources/read` request to
return more than one content item. Each returned item may have its own URI.

A typical example is a folder-like resource. A client asks to read
`file:///docs/`. The server may answer with content for `file:///docs/a.md` and
`file:///docs/b.md` in the same response.

Em See Pea already validates the response with the installed MCP software
development kit (SDK) schema. It then adds one extra rule of its own: every
returned content URI must exactly match the requested URI. That extra rule
rejects valid MCP responses.

This decision removes only that extra equality rule. Returning a URI does not
register a resource, grant Em See Pea access, trigger framework fetching, or
make the URI directly readable through Em See Pea.

## Decision Drivers

- Allow MCP-valid `resources/read` responses that contain several content items.
- Authorize the read against the originally requested resource, not against each
  returned URI.
- Treat returned URIs as content identifiers that do not create readable Em See
  Pea resources.
- Keep existing SDK validation, size limits, cancellation, deadlines, and
  generic safe errors.
- Use the same rule for static resources and resource templates.
- Do not add dynamic resource registration, catalogue mutation, sampling,
  retries, replay, persistence, or reconnect recovery.

## Considered Options

1. **Checked multi-content resource reads (chosen)**: accept multiple SDK-valid
   text or blob contents whose URIs may differ from the requested URI, without
   making those URIs directly readable through Em See Pea.
2. **Keep exact requested-URI equality**: continue rejecting every returned
   content whose URI differs from the request.
3. **Register returned URIs dynamically**: treat each returned content URI as a
   new resource that can later be read directly.

## Decision Outcome

Chosen option: **"Checked multi-content resource reads"**, because Model Context
Protocol (MCP) allows one resource read to return several content items. Em See
Pea will still treat the originally requested resource as the only authorized
read.

Static-resource and resource-template handlers may return more than one valid
text or blob content item. A returned content URI does not need to equal the URI
the client requested.

Authorization still happens before the handler runs, and it is still based on
the resource the client requested. Cache instructions apply to the whole
response.

Returned content URIs identify items in the response. Returning them does not
register new resources, make those URIs directly readable through Em See Pea,
grant new access, or make Em See Pea fetch anything from those URIs. A later
direct read of an unknown URI still returns the existing safe error.

The existing SDK schema validation, copied validated result, generic safe
errors, cancellation, deadlines, whole-result byte limits, cache instructions,
and unknown-resource handling remain in force.

This increment does not add any new resource-result immutability mechanism
beyond the existing SDK-validated copy.

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

- Application documentation must not describe returned content URIs as links
  that can be read later through Em See Pea unless those resources are
  registered separately.
- Handler authors must treat one authorized read as permission to return only
  the content that belongs to that requested resource.

## Confirmation

### Protocol Behavior

- Static-resource and resource-template handlers can each return multiple text
  and blob contents with URIs different from the requested URI.
- The official MCP client pinned to `2026-07-28` receives every content intact.
- Legacy clients preserve their documented resource-read behavior.

### Access Boundary

- Protected reads authenticate and authorize the requested capability before
  the handler runs.
- A returned URI gains no listing entry or direct-read authority.
- Results invalid under the software development kit (SDK) schema and oversized
  results retain the generic safe resource error.
- Cancellation, deadlines, cache instructions, discovery suppression, and
  existing unknown-resource behavior remain unchanged.

### Qualification

- Source, type, black-box, packed-package, and benchmark checks pass from clean
  checkouts, with the measured benchmark inside ADR-0014's budget.
- A released-package journey exercises both static and template multi-content
  reads, separately from publication and registry-integrity evidence.
- Registry readback verifies the released package version, integrity,
  signatures, provenance, and public types.

### Documentation

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
