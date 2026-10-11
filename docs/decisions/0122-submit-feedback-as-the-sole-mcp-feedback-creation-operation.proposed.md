---
status: "proposed"
date: 2026-10-12
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2027-01-12
supersedes: ["ADR-0066"]
---

# Submit Feedback as the Sole Model Context Protocol (MCP) Feedback Creation Operation

## Context and Problem Statement

The feedback package currently advertises two Model Context Protocol (MCP)
tools that can start the same durable feedback conversation:
`submit-feedback` from `defineFeedbackSubmission` and
`create-feedback-thread` from `defineFeedbackConversation`. Adopters need the
conversation helper for replies and retrieval, but advertising two creation
tools gives an artificial intelligence (AI) client an unnecessary choice and
can produce inconsistent creation journeys.

The conversation helper must retain access to existing stored threads while new
feedback conversations use one clear entry point. This decision replaces the
creation-tool part of the earlier detailed-feedback decision. It preserves that
decision's durable conversation, backend, authorization, event, and receipt
architecture.

In this decision, a durable conversation is a feedback thread stored so it
remains available after the request that created it. A storage adapter is the
integration that reads and writes those threads in a supported backend. A
lifecycle hook is an adopter callback invoked at a defined stage of an
operation. A constructor is the package function that creates configured MCP
tools. "MCP-facing" means exposed to clients as an MCP tool. An opaque scope
string is an authorization value whose internal structure callers must not
interpret. A scope projection is the shared `scope(principal)` function that
converts the framework's standard authenticated-principal representation into
an opaque scope string. A receipt is a stored timestamp recording that a team message was
included in a validated MCP tool result; it does not prove that a person read
the message. Effect semantics describe whether an operation changes state.
Retry semantics describe whether the framework may automatically repeat an
operation.

## Decision Drivers

- Give AI clients one unambiguous tool for recording new feedback.
- Keep existing thread identifiers usable for replies and retrieval.
- Preserve the storage adapters that remain the authoritative source.
- Preserve owner scoping, meaning that each authenticated owner can access only
  the records within their authorized scope.
- Preserve lifecycle hooks, emitted events, deadline handling, cancellation,
  and receipts recording when a team message was included in a validated MCP
  tool result.
- Avoid a hidden compatibility tool or operation-selection setting that keeps a
  second creation path callable.
- Make the breaking public tool-surface change explicit and testable.

## Considered Options

1. **Use `submit-feedback` as the sole MCP feedback creation operation**:
   remove `create-feedback-thread` and keep reply, list, and get operations in
   the conversation helper.
2. **Keep legacy creation callable but undiscoverable**: hide
   `create-feedback-thread` from discovery while retaining a second callable
   creation path.
3. **Keep both creation tools discoverable**: preserve the existing public
   surface and leave tool choice to the AI client.

## Decision Outcome

Chosen option: **"Use `submit-feedback` as the sole MCP feedback creation
operation"**, because a single creation tool gives adopters and AI clients a
clear contract without weakening the durable conversation capability.

`defineFeedbackConversation` exposes exactly three MCP tools:
`reply-to-feedback-thread`, `list-feedback-threads`, and
`get-feedback-thread`. It does not expose a hidden, aliased, configurable, or
otherwise callable legacy creation tool. Its public annotation configuration
contains only reply, list, and get overrides. An annotation override is
adopter-supplied metadata that replaces the default MCP metadata for a named
tool.

`defineFeedbackSubmission` remains the only constructor that exposes an MCP
feedback creation tool.
To create a durable conversation, an adopter configures
`defineFeedbackSubmission` with a submission adapter, meaning the integration
that handles a submitted feedback record. For durable conversations, this
adapter delegates thread creation to `createThread` on the conversation storage
adapter configured for `defineFeedbackConversation`. Both helpers must use the
same configured backing store and the same scope projection. This conversation
storage adapter remains the authoritative source for the thread. Every
successful call through that submission adapter creates a durable conversation.
The returned submission identifier is the canonical thread identifier accepted
by the conversation tools. Other submission adapters may keep their existing
one-way storage behavior and do not gain a conversation implicitly. The package
keeps the internal backend operation that creates a thread and its existing
validated input and output types because conversation-producing submission
adapters still need them.

Existing stored threads are not migrated or rewritten. Their identifiers,
messages, sequence, status, and receipts remain unchanged. The same storage
adapter remains the authoritative source for each thread. Access also remains
unchanged: the framework first converts the authenticated identity into its
standard principal representation, then derives the owner scope used to
authorize access. Architecture Decision Record (ADR) 0066 defines this protected
conversation scope. In this decision, that standard identity representation is
the "framework-normalized principal". `defineFeedbackSubmission` and
`defineFeedbackConversation` must use the same `scope(principal)` function and
must produce the same opaque scope string for the same authenticated principal.
Apply this same scope projection when creating a submission and when listing,
retrieving, or replying to its conversation.

## Consequences

### Good

- AI clients see one clear way to start feedback.
- Adopters can add reply and retrieval without advertising duplicate creation.
- Existing conversations and support-system records remain usable.
- Removing one tool reduces the feedback discovery surface.

### Neutral

- Backend adapters still implement thread creation even though the conversation
  helper no longer exposes it as an MCP tool.
- Adopters that combine the submission and conversation helpers must configure
  both helpers with the same `scope(principal)` function, and that function must
  return the same opaque scope string for the same authenticated principal.

### Bad

- This removes a published MCP tool and the metadata override that configured
  its `create` annotation.
- Legacy callers must migrate from the removed `subject` and `message` contract
  to the published `submit-feedback` input schema, including its allowed
  categories and 4,000-character `detail` limit, and consume the replacement
  `id` and `recordedAt` result. The package README, website guide, and release
  note contain the exact migration procedure.
- `submit-feedback` returns the stable identifier and recording time, not the
  full newly created conversation.

## Confirmation

In the following criteria, the "published package under review" is the package
version selected by the npm registry's `latest` tag after publication, with
package provenance that identifies the exact released source commit.

### Source and contract verification

- Exported TypeScript declarations, MCP discovery output, documentation,
  examples, and public-contract test fixtures contain no callable or
  configurable `create-feedback-thread` tool.
- `defineFeedbackConversation` returns exactly the reply, list, and get tools.
  Each tool keeps its existing authorization rules, metadata annotations, and
  input and output schemas.
- The behavior of `submit-feedback`, `reply-to-feedback-thread`,
  `list-feedback-threads`, and `get-feedback-thread` does not change based on
  the order in which those tools are registered or called.
- The effect and retry rules from ADR-0066 remain unchanged. Calls that create
  or reply to a thread can change stored data more than once if repeated, so the
  framework must not retry them automatically. A get operation that records a
  receipt showing that a team message was included in a validated MCP tool
  result also changes stored data and must not be retried automatically. Failure
  to record a receipt does not hide a support reply.
- A `submit-feedback` result can be retrieved and replied to immediately using
  its returned identifier when both helpers use the same `scope(principal)`
  function and the same resulting opaque scope string for that authenticated
  principal.
- A thread stored before the tool removal remains listable, readable, and
  replyable without data migration.
- Backend, hook, event, deadline, cancellation, owner-isolation, and receipt
  tests pass for PostgreSQL, Firestore, GitHub Issues, and Zendesk.

### Independent published-package verification

- The published package under review discovers `submit-feedback` plus the three
  conversation tools and does not discover `create-feedback-thread`.
- Using the same `scope(principal)` function and resulting opaque scope string,
  the published package under review passes a submit, get, and reply journey
  using the returned `id` in an independent installation.
- The published package under review can also list, get, and reply to a thread
  stored before the removal in that independent installation.
- All of this evidence is required before this proposal is accepted.

## Pros and Cons of the Options

### Use `submit-feedback` as the sole MCP feedback creation operation

- Good: provides one creation contract and the smallest tool surface.
- Good: keeps reply and retrieval independently useful.
- Bad: requires migration for callers of the removed tool.

### Keep legacy creation callable but undiscoverable

- Good: avoids immediately breaking direct legacy calls.
- Bad: retains two creation contracts and makes the hidden one harder to
  inspect, test, and support.

### Keep both creation tools discoverable

- Good: requires no adopter migration.
- Bad: preserves the ambiguous tool choice reported by adopters.

## Reassessment Criteria

Reassess if `submit-feedback` cannot represent a demonstrated feedback creation
journey without weakening authorization, persistence, or the published
`submit-feedback` input schema, including its allowed categories and
4,000-character `detail` limit. Any future creation operation requires a
separate decision and must not silently revive the removed tool.
