---
status: "proposed"
date: 2026-09-10
human-oversight: confirmed
oversight-date: 2026-09-10
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-10
---

# Pluggable Detailed Feedback Conversations and Event Hooks

## Context and Problem Statement

MCP applications need to learn from explicit errors and successes, but also from
friction that is harder to classify: unnecessary effort, annoyance, confusion,
repetition, capability mismatches, and surprising outcomes. A categorical
signal without an explanation is rarely actionable.

Feedback also needs a return path. A team must be able to reply and action the
work in its existing database or ticketing system, while the AI can retrieve
those replies and continue the conversation. Existing implementations show two
failure modes: one-way analytics that lacks useful detail, and entry-based
polling with mutable pending messages, weak threading, and no evidence that a
team response reached the AI.

The capability must compose with any Em See Pea application shape. Its storage,
ticketing, email, queue, webhook, or other event handling must be replaceable
without exposing raw requests to plugins or creating a generic lifecycle and
retry framework.

## Decision Drivers

- Capture actionable detail about errors, success, friction, annoyance,
  confusion, repetition, surprises, capability gaps, and suggestions.
- Record feedback openly without interrupting the user with a permission prompt.
- Support durable back-and-forth conversations with append-only history.
- Let support teams remain in GitHub Issues, Zendesk, or their existing database
  workflow.
- Provide honest evidence that a reply was offered to the AI without claiming
  human comprehension.
- Let applications handle typed feedback events without exposing request or
  response bodies through observability.
- Keep persistence authoritative when hooks, email, or other notifications fail.
- Align retry and atomicity claims with each backend's actual guarantees.
- Preserve public discovery by default and authenticate protected conversation
  operations before application or backend work.

## Considered Options

1. **Optional feedback package with detailed submissions, durable conversations,
   vendor-authoritative adapters, and typed event hooks**: provide one checked,
   capability-specific contract that applications can compose with any server.
2. **Application-owned feedback tools and integrations**: document patterns but
   leave every application to define its tools, threading, persistence, receipts,
   and notifications.
3. **Generic framework lifecycle plugin**: expose request and response hooks that
   arbitrary plugins can use for feedback, storage, notification, and workflow.

## Decision Outcome

Chosen option: **"Optional feedback package with detailed submissions, durable
conversations, vendor-authoritative adapters, and typed event hooks"**, because
it makes the user-facing and backend contracts reusable without weakening the
checked kernel or forcing feedback into every server.

### Package and capability surface

Publish an optional `@emseepea/feedback` package. It exports two separate
constructors:

- `defineFeedbackSubmission` creates a public-capable, one-way detailed feedback
  capability.
- `defineFeedbackConversation` creates a protected-by-default, durable
  conversation capability.

Detailed submissions contain bounded explicit prose describing what happened,
what was helpful, what failed, what was unexpectedly good or bad, or what the
user expected instead. Applications may add a bounded structured schema for
their own safe context. The capability never captures surrounding chat history,
raw tool arguments, raw results, credentials, identifiers, or application
payloads automatically.

Conversation tools create threads, append user messages, list threads, and get
one ordered thread. Threads and messages have stable public IDs. Messages are
append-only and carry stable sequence numbers, authors, kinds, and timestamps.
Team replies never overwrite earlier replies. Categories and provider labels are
metadata rather than substitutes for conversation history.

Protected conversations are scoped from the framework-normalized principal.
The current principal supports a client-scoped claim, not a claim that a
particular human participated. A future human or account identity model requires
its own decision. Public cross-session conversations require an explicit safe
identity or opaque receipt design and are not claimed by this decision.

### Model invocation policy

The feedback tool description tells the AI to record one notable observation
without asking permission first, then openly tell the user in the same response
what was recorded. It must never record feedback silently.

Notable observations include errors, friction, annoyance, unnecessary effort,
repetition, confusion, unexpected good or bad results, a mismatch between the
user's intent and available capabilities, suggestions, wishes, clear first-call
success, and explicit satisfaction.

The AI does not record normal expected empty results, ordinary uneventful
operation, session opening or closing, or the same observation twice. If the
user objects, it does not record more feedback during that conversation. These
conversation behaviours are model guidance qualified by native semantic tests,
not runtime guarantees the server falsely claims to enforce.

### Backend contract and vendor authority

The package defines checked domain operations for creating a thread, appending a
message, listing threads, and getting a thread. Adapter input and output cross
explicit runtime schemas. Context contains only the deadline, cancellation, and
an opaque application-selected scope. Raw credentials, provider claims, and
vendor errors do not cross the boundary.

PostgreSQL and Firestore adapters store append-only threads and messages with
scope isolation and stable ordering. Database notification reliability uses a
backend-owned transactional outbox when configured.

GitHub Issues and Zendesk remain authoritative rather than being mirrored into a
second conversation database:

- GitHub maps a thread to an issue and messages to comments. Support staff use
  native comments, labels, assignees, milestones, closing, and reopening. The
  adapter imports those changes and writes later user replies back to the same
  issue.
- Zendesk maps a thread to a ticket and messages to public comments. Agents use
  native assignment, categorisation, public replies, and status changes. Private
  notes never reach the user. The adapter imports the public ticket history and
  writes later user replies to the same ticket.

Adapters use exact stable vendor thread, message, and event IDs. They do not
search by title or other first-match heuristics. Provider-safe labels and status
values pass through when useful rather than being translated into a duplicated
catalogue.

External GitHub or Zendesk events enter through a checked ingestion boundary.
The adapter authenticates the webhook or poll source, applies size and deadline
limits, maps it to a validated feedback-domain change, deduplicates the stable
vendor event ID, commits the change, and only then returns normalized events for
hook dispatch.

### Offered-to-client evidence

When a team message is selected for inclusion in a validated MCP result, the
adapter may record `offeredToClientAt` once for that stable message ID. This means
only that the message was included in a successfully constructed tool result
available to the AI. It is not called `seen`, and it makes no claim about human
attention or comprehension.

No acknowledgement tool, button, or user reply is required. Native semantic
evaluations independently verify that qualified AI clients present the meaning
of team replies to users.

A list or get operation that records offered state is effectful, is not marked
read-only, and is never retried automatically. Receipt failure does not hide a
support reply from the AI. Database adapters enforce uniqueness for the first
offer. GitHub may represent the first offer with an idempotent reaction on the
exact support comment. Zendesk may use configured agent-visible receipt fields
and the ticket audit trail. Each adapter documents any narrower atomicity claim.

### Typed feedback event hooks

The package exposes feedback-specific event hooks, not generic request lifecycle
hooks. Framework-created immutable events use a small finite vocabulary:

- `feedback.thread.created`
- `feedback.message.added`
- `feedback.status.changed`
- `feedback.message.offered-to-client`

Events contain only a stable event ID, event type, occurrence time, opaque scope,
thread ID, optional message ID, and optional finite author value. They contain no
feedback body, summary, email address, recipient, raw vendor payload, free-form
metadata, request, response, credential, or provider error. An authorised
application handler may use the IDs to read the domain data it needs from its
configured backend.

Hooks run after durable feedback state succeeds. Dispatch uses the request's
absolute deadline and cancellation signal, is skipped or cancelled when no time
remains, and creates no detached background work. Hooks are best-effort and are
not retried by Em See Pea. Hook failure cannot roll back feedback, change an MCP
response, or bypass authentication, validation, limits, cancellation, or safe
errors. Stable event IDs let consumers deduplicate their own work.

Applications may connect hooks to email, Slack, queues, webhooks, analytics, or
other handling. Reliable database delivery requires a backend-owned
transactional outbox written with the feedback change. GitHub and Zendesk prefer
their native notifications and automation. A direct post-write email callback
does not receive a durability claim.

### Effect and retry semantics

Initial write tools are non-idempotent and receive no automatic framework retry.
An adapter may claim retry safety only when it atomically deduplicates a stable,
model-hidden operation identifier. The model never supplies or invents an
idempotency key. No universal effect, queue, scheduler, or retry framework is
added.

### Documentation and maintained examples

Default initializer output remains unchanged and contains no feedback dependency
or setup. Standalone composition tests prove that the optional package works with
every maintained initializer without maintaining another template tree. Focused
reference examples demonstrate the complete feedback journeys. The documentation
explains when to use one-way submissions rather than conversations, open
recording without permission prompts, the stop-on-objection behaviour, backend
guarantees, hook failure semantics, and provider-native email or notification
choices.

Reference examples cover PostgreSQL, Firestore, GitHub Issues, and Zendesk. They
show the complete support journey, not merely issue or ticket creation.

## Consequences

### Good

- Feedback contains enough detail to investigate rather than only an aggregate
  category.
- Support staff can reply and action feedback in their existing system.
- Append-only messages support real multi-turn conversations.
- Applications can connect feedback events to their preferred integrations.
- Provider and database guarantees remain explicit instead of being flattened
  into a false common promise.

### Neutral

- Public one-way submissions and protected conversations are separate contracts.
- Reading a thread can be effectful when it records an offered receipt.
- Reliable notifications use provider-native automation or backend-owned state.

### Bad

- Four maintained adapters create a significant integration and qualification
  surface.
- Model openness, objection, and duplicate-avoidance behaviour cannot be
  guaranteed by server code alone.
- Client-scoped identity is weaker than a human or account identity.
- Best-effort hooks can be missed if the process fails after persistence and
  before dispatch.

## Confirmation

- The package exposes separate detailed-submission and conversation constructors
  without changing the framework observability event contract.
- Public submissions accept bounded explanatory prose and application-declared
  structured context, while tests prove there is no automatic chat, payload,
  credential, identifier, or sensitive-value capture.
- Conversation tests prove scope isolation, append-only ordering, pagination,
  concurrent writes, status changes, and exact thread correlation.
- PostgreSQL and Firestore contract tests prove their documented atomicity,
  receipt uniqueness, and optional transactional outbox behaviour.
- GitHub integration tests prove issue creation, exact issue correlation, support
  comments, labels, assignment, milestones, close and reopen changes, client
  offer receipts, later user comments, and native notification compatibility.
- Zendesk integration tests prove ticket creation, exact ticket correlation,
  requester and agent public comments, private-note exclusion, assignment,
  categorisation, status changes, client offer receipts, later user comments,
  ticket audit visibility, and native email compatibility.
- Checked ingestion tests reject unauthenticated, oversized, invalid, duplicate,
  expired, and caller-selected-destination vendor events before state or hook
  effects.
- Hook tests prove immutable minimal events, bounded dispatch attempts, failure
  isolation, consumer deduplication support, and absence of feedback
  bodies, summaries, recipients, raw vendor data, credentials, requests, and
  responses.
- Native multi-turn semantic tests, without coaching context, prove the AI
  records each notable positive or negative observation openly, does not ask
  permission first, does not record expected empty or uneventful behaviour,
  stops after objection, avoids duplicate observations, retrieves team replies,
  presents their meaning to the user, and continues the same thread.
- Semantic evidence contains synthetic non-sensitive conversations, tool calls,
  tool results, assistant responses, expectations, and judge reasons.
- Ordinary checks run before the later, more expensive semantic evaluations.
- README files, the website, API reference, generated standalone projects,
  software bills of materials, provenance, registry readback, and clean-install
  verification cover the released feedback package and supported adapters.
- No feedback performance claim is published until representative database and
  ticketing profiles are measured with a stated percentile and workload.

## Pros and Cons of the Options

### Optional Feedback Package with Detailed Submissions, Durable Conversations, Vendor-Authoritative Adapters, and Typed Event Hooks

- Good: Provides one checked reusable capability without burdening servers that
  do not need feedback.
- Bad: Makes the package responsible for multiple backend and workflow contracts.

### Application-Owned Feedback Tools and Integrations

- Good: Keeps Em See Pea smaller and lets each application choose its own model.
- Bad: Repeats the same privacy, threading, receipt, retry, and semantic mistakes
  across adopters.

### Generic Framework Lifecycle Plugin

- Good: Allows integrations to observe and alter almost any request stage.
- Bad: Exposes sensitive data and makes checked ordering, redaction, and failure
  isolation unenforceable.

## Reassessment Criteria

Reassess if MCP standardizes server-to-client feedback delivery receipts, if a
human or account identity becomes part of the normalized principal, if two
feedback capabilities prove a shared effect provider boundary, if vendor APIs
cannot preserve the required conversation semantics, or if measured adapter and
hook costs exceed a later ratified performance budget.
