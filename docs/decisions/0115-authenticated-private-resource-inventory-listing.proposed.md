---
status: "proposed"
date: 2026-10-09
human-oversight: confirmed
oversight-date: 2026-10-09
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2027-01-09
---

# Authenticated Listing of Private Resource Inventory

Tom Howard ratified this decision's exact terms on 2026-10-09. Human approval
authorizes implementation within these terms. The status remains proposed until
implementation and production validation are complete; this record does not
claim that the capability exists.

## Context and Problem Statement

[Issue #146](https://github.com/emseepea/emseepea/issues/146) describes an
application that stores documents, reference questions, and diagrams for each
authenticated learner. Protected resource templates let a learner read a known
URI, but the supported framework API cannot list that learner's stored files.
Registering every learner's inventory at startup would expose private metadata
and cannot represent records created after deployment.

[ADR-0080](0080-immutable-capability-catalogues-through-redeployment.proposed.md)
keeps checked capability definitions immutable for a process lifetime.
[ADR-0064](0064-typed-authentication-with-optional-permission-shaped-discovery.proposed.md)
establishes normalized authentication, authorization before backend work, and
pure filtering of capability discovery. Private record enumeration needs backend
work, so it requires an explicit distinction from that capability filtering.

This decision serves the existing MCP server developer persona's JTBD-002,
adding optional capabilities, and the framework maintainer persona's JTBD-100,
extending the supported protocol. It introduces no new job or persona.

## Decision Drivers

- Let an authorized caller discover their own readable resource inventory.
- Keep capability definitions and access rules under deployment control.
- Authenticate and authorize before invoking a listing backend.
- Bound responses and cursor lifetime without maintaining frozen snapshots.
- State what concurrent writes, deletion, and permission changes mean.
- Preserve the separate authorization boundary for resource content reads.

## Considered Options

1. **Fixed templates with authenticated, live inventory listing (chosen)**:
   compile listing callbacks at startup and enumerate authorized application
   records through bounded pages, without a frozen snapshot.
2. **Frozen inventory snapshots**: retain a consistent inventory view throughout
   traversal, with additional storage, cleanup, and permission-revocation rules.
3. **Startup registration only**: retain the existing catalogue model and require
   applications to solve private inventory discovery outside this framework API.

## Decision Outcome

Chosen option: **"Fixed templates with authenticated, live inventory listing"**,
ratified on the following terms.

### Fixed definitions, changing records

Resource templates, handlers, listing callbacks, and access rules are compiled
and validated at startup. Adding or replacing those definitions requires a new
deployment. A listing callback may query changing application records, but cannot
register capabilities, change routing, or change access rules.

This decision supplements ADR-0080 and ADR-0064. It introduces a narrow exception
to pure capability discovery for opted-in `resources/list` inventory queries;
the rest of both decisions remains applicable. It does not supersede either
decision in full.

### Authentication and owner isolation

Private inventory listing is explicitly enabled by the deployment. When enabled,
`resources/list` requires valid authentication even if the server otherwise uses
public capability discovery. Other discovery methods, including
`resources/templates/list`, retain their existing configured rules. Servers
without inventory listing keep their existing behavior.

Each listing callback receives the same validated caller context and scopes used
for protected reads. Bearer tokens and raw provider claims are not passed to it.
The framework checks the relevant template's access policy before invoking the
callback. Inaccessible listing sources are omitted without backend calls; a
caller authorized for no inventory source is rejected. A caller need not hold
every source's scopes to list the sources they may access.

The application must constrain its query and any record-level authorization to
the current caller's ownership and access policy. A caller cannot select another
owner through listing parameters or a cursor. Identity-dependent responses are
private and non-cacheable. Failures must not disclose another owner's inventory,
hidden template details, credentials, or backend query state.

### Metadata and bounds

Listings return resource URI, name, and MIME-type metadata, not resource content.
Each listed URI must match its registered template and be supported by its
protected read handler, subject to later deletion or permission changes.

The framework applies its configured resource-list page-size and response-byte
bounds to the combined response, including existing static entries and every
eligible inventory source. Backend requests and results must also be bounded;
implementation must not retrieve an entire inventory to construct one page.
Invalid or oversized callback results fail at the checked public boundary.

### Stable ordering without a frozen snapshot

Sources have a deterministic deployment-fixed order. Within each source, the
application supplies a stable, immutable ordering key with a unique tie-breaker.
Pagination continues strictly after the last position consumed. For an unchanged
finite inventory, a traversal must enumerate eligible entries without duplicates,
omissions, repeated continuation cursors, or an unbounded empty-page loop.

Each page reads current records and applies current authorization. There is no
frozen snapshot and no guarantee of a complete inventory at one point in time.
Concurrent insertions before an already consumed position may be missed until a
new traversal; insertions after it may appear on later pages. Deleted or newly
forbidden records disappear. Replaying a cursor may therefore return a changed
page. Inventory listing is not a durable change-consumption API.

### Cursor binding and expiry

Cursors are opaque and integrity-protected. They are bound to the authenticated
caller, relevant scope/permission view, listing sources and templates, deployment
catalogue, and continuation position. They cannot be reused across callers or
different authorization views and must not expose readable private identity,
resource content, credentials, or backend query state.

A traversal expires 15 minutes after its first page is issued. Continuation
cursors retain that original expiry; advancing or replaying a page does not
extend it. Invalid, altered, expired, or no longer recognized cursors fail safely
and require a new traversal. Authentication and authorization are rechecked on
every page, including cursor replay.

This decision promises no cursor portability across process replacement or
serving instances. The supported API documentation must explain that boundary,
any cursor-related state and its bounded cleanup, and how clients restart a
traversal. A future portability guarantee requires a separate decision.

### Reads, deletion, and revocation

A listing is not an access grant. Every `resources/read` rechecks authentication,
template access, ownership, and current record-level authorization before
returning content. A resource deleted or newly forbidden after listing becomes
unavailable through the existing safe read-error behavior. The response must not
reveal whether an inaccessible record belongs to another caller.

### Protocol and client claims

This decision adds no list-change notifications and retains `listChanged: false`.
The inventory is current when a client explicitly requests a page; the framework
does not promise proactive inventory refresh, snapshot recovery, or subscriptions.

The capability is MCP resource discovery. It makes no claim that ChatGPT Sources
will display listed items or that a native client will render Markdown or images.
Native-client claims require separate evidence, including the work in issue #145.

## Consequences

### Good

- Learners can discover their private files through the supported MCP API.
- Fixed definitions preserve startup validation and deployment-controlled routing.
- Current authorization governs both metadata discovery and content reads.
- Bounded live pages avoid framework-owned frozen inventory snapshots.

### Neutral

- Applications remain responsible for ownership queries and record-level policy.
- Concurrent changes may require a client to start another traversal.
- Opting into private inventory protects the entire `resources/list` method.
- A disconnected or redirected client may need to restart pagination.

### Bad

- The framework gains a backend-driven listing boundary and cursor validation.
- Applications cannot obtain a point-in-time inventory from this API.
- Very large or slow traversals may outlive the fixed 15-minute expiry.

## Confirmation

These checks are required before an implementation can be released.

- The public API accepts optional startup-declared listing callbacks and rejects
  unenforceable access policies before listening.
- Real MCP-client tests show two callers see only their authorized URI/name/MIME
  metadata, including callers with the same scopes but different ownership.
- Missing or invalid authentication and missing required permissions cause zero
  unauthorized listing-backend calls. Mixed sources require only applicable scopes.
- Known or forged cross-owner URIs remain unreadable through direct reads.
- Pages and backend results obey count and byte bounds across multiple sources
  and more than one batch. Invalid metadata and template mismatches fail closed.
- Unchanged inventories enumerate completely in stable order. Concurrent inserts,
  deletions, cursor replay, and revocation behave as documented without a snapshot.
- Cross-caller, changed-scope, changed-template, altered, and expired cursors are
  rejected. Tests prove the 15-minute traversal expiry cannot be extended.
- A deleted or newly forbidden item cannot be read after appearing in a page.
- Public capability discovery without inventory listing remains compatible;
  `listChanged: false` remains truthful and no list-change notifications are sent.
- Documentation covers the callback contract, ownership responsibility, ordering,
  cursor expiry and restart, process/instance limits, cleanup, and safe read errors.
- Normal protocol, packed-consumer, authentication-isolation, qualification, and
  release gates pass. Native-client success requires its own separate evidence.

## Reassessment Criteria

Reassess if applications demonstrate a need for frozen snapshots, portable
cross-instance cursors, proactive list-change notifications, or a different cursor
lifetime; if MCP changes the discovery contract; or if measured backend and
pagination costs cannot stay within the existing checked execution boundaries.
