---
status: "proposed"
date: 2026-10-05
human-oversight: confirmed
oversight-date: 2026-10-05
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2027-01-05
---

# Feedback Collections Are Deployment-Static Authorization Partitions with Independently Composable Submission, Monitoring, and Operator Roles

> Captured via `/wr-architect:capture-adr`. The decision substance was derived
> from the request and architecture review. Tom Howard ratified the final
> proposal on 2026-10-05.

## Context and Problem Statement

A Model Context Protocol (MCP) deployment can receive feedback intended for an
internal team, feedback
intended for a customer-facing support workflow, or both. The deployment may
also let operators monitor changes and retrieve authoritative feedback records.
Treating these concerns as one server-wide capability would grant more access
than some deployments need. Letting a caller choose a destination would weaken
the deployment's authorization boundary and confuse feedback origin or audience
with account, client, or human identity.

The architecture needs one stable way to separate feedback collections while
allowing an authorized internal MCP to combine the roles it genuinely needs.
ADR-0066 continues to govern detailed feedback conversations and authoritative
support-system handling. ADR-0109 continues to govern opt-in MCP Events.

## Decision Drivers

- Keep feedback destination under deployment control rather than user or model
  control.
- Grant submission, monitoring, and operator retrieval independently according
  to the needs of each feedback collection.
- Allow one authorized internal MCP to combine roles without making that overlap
  mandatory for other MCPs.
- Keep customer-facing MCPs limited to customer-feedback submission.
- Preserve the existing support system as the authoritative place for
  assignment, status, tags, replies, notifications, and private notes.
- Keep collection membership distinct from account, client, or human identity.

## Considered Options

1. **Deployment-static collection partitions with independently composable roles
   (chosen)** — A deployment fixes its collections and separately authorizes
   submission, monitoring, and operator retrieval for each collection.
2. **One server-wide feedback capability** — Enabling feedback would enable the
   same submission, monitoring, and retrieval surface for every collection.
3. **Caller-selected feedback destination** — A user or model would choose the
   target collection when submitting feedback.

## Decision Outcome

Chosen option: **"Deployment-static collection partitions with independently
composable roles"**, because it provides least-privilege composition without
turning collection selection into caller-controlled routing.

A feedback collection is a deployment-static authorization partition describing
feedback origin and audience. It is not an account, client, or human identity.
The initial collection vocabulary is `internal` and `customer`.

For each collection, a deployment independently opts into and authorizes three
roles:

- submission;
- monitoring through MCP Events; and
- operator list and retrieval.

The roles may intentionally overlap on one internal MCP. Monitoring may cover
`internal`, `customer`, or both, but each Events subscription selects only an
authorized subset. Event delivery does not become another feedback store: events
contain no feedback body and identify authoritative records by stable reference.
Operator retrieval remains a separate authorization decision.

An internal MCP feedback-submission tool is fixed by server configuration to the
`internal` collection. Its users and models cannot supply or select a destination.

A customer-facing MCP exposes only customer-feedback submission. It exposes no
event discovery, subscription, or delivery capability, and no operator list or
retrieval capability.

This decision supersedes nothing. ADR-0066 and ADR-0109 remain applicable.

## Consequences

### Good

- Deployments can grant only the feedback roles needed for each collection.
- One internal MCP can intentionally combine submission, monitoring, and
  operator work without forcing those roles onto customer-facing MCPs.
- Fixed submission destinations prevent users and models from crossing the
  internal and customer audience boundary.
- Body-free events and separately authorized retrieval keep the support system
  authoritative.

### Neutral

- The same internal MCP may expose overlapping roles when its deployment grants
  them.
- Changing a collection or its available roles requires a deployment change.
- A subscription may monitor one collection or an authorized combination of
  collections.

### Bad

- Deployments that need different role combinations must declare and operate
  those combinations explicitly.
- Operators cannot use event access as an implicit grant to retrieve feedback
  content.
- A customer-facing MCP cannot double as an operator console or event source.

## Confirmation

- A deployment can enable submission, monitoring, and operator retrieval
  independently for each collection, including an intentional overlap of roles
  on one internal MCP.
- An internal feedback-submission tool accepts no destination selection and
  records feedback only in the deployment-configured `internal` collection.
- An operator can subscribe through MCP Events to `internal`, `customer`, or
  both only when that exact subset is authorized.
- Monitoring events contain a stable authoritative reference and no feedback
  body; retrieving the referenced record requires separate operator authority.
- A customer-facing MCP exposes customer-feedback submission and exposes no
  event or operator capability.
- Assignment, status, tags, replies, notifications, and private notes remain in
  the authoritative support system.

## Pros and Cons of the Options

### Deployment-Static Collection Partitions with Independently Composable Roles

- Good, because each role and collection can follow least privilege while an
  internal MCP can still combine deliberately authorized work.
- Bad, because deployments must declare each intended role combination.

### One Server-Wide Feedback Capability

- Good, because it has a smaller configuration surface.
- Bad, because enabling one feedback role grants unrelated monitoring or
  operator capabilities and makes a submission-only customer surface impossible.

### Caller-Selected Feedback Destination

- Good, because one submission tool could appear to route every kind of
  feedback.
- Bad, because users or models could select an audience boundary that must be
  controlled by deployment authorization.

## Reassessment Criteria

Reassess if the supported collections need to change independently of a
deployment, if MCP Events standardizes a different authorization relationship
between subscription and authoritative retrieval, or if production evidence
shows that independently authorized roles cannot preserve the intended
collection boundaries.
