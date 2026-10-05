---
title: Add feedback
description: Add useful one-way feedback or a durable support conversation to any Em See Pea server.
---

Feedback is optional and works with every starter. Choose the starter that fits
your tool, API, database, SOAP, progress, or user interface. Then install:

```sh
npm install @emseepea/feedback
```

## Choose the smaller feedback mode

Use a detailed submission when the team needs one useful observation but does
not need to reply. Use a protected conversation when support must reply and the
AI must bring the response back to the user.

Both modes record explicit, bounded content. They do not automatically capture
chat history, raw tool inputs or results, credentials, or application payloads.

## Add one-way feedback

```ts
import { defineFeedbackSubmission } from "@emseepea/feedback";
import { createPostgresFeedbackSubmissionBackend } from "@emseepea/feedback/postgres";

const feedback = defineFeedbackSubmission({
  access: "public",
  scope: "pea-guide",
  backend: createPostgresFeedbackSubmissionBackend({ pool }),
});

const app = await createToolServer({
  additionalTools: [feedback],
});
```

The tool description tells the AI when feedback is notable. This includes an
error, friction, annoyance, unnecessary difficulty, confusion, repetition,
surprising good or bad results, a capability mismatch, a suggestion, or clear
success.

It also tells the AI to record one observation without asking a separate
permission question, then openly tell the user what it recorded in the same
response. It must avoid normal uneventful operation and duplicates, and stop if
the user objects. These are model behaviours, so test them with every supported
AI client.

The successful structured result includes `nextAction`. It reminds the AI to
finish every part of the user's original request before briefly stating the
specific feedback recorded. A routine successful tool call, structured result,
or expected number of steps is not feedback-worthy.

## Separate customer and internal feedback

A collection is a deployment-configured authorization partition, such as
`customer` or `internal`. It fixes where feedback goes; it does not identify
the account or person. Configure submission, monitoring, and operator roles
separately.

- Customer-facing MCP: submits customer feedback only, with no monitor or operator capabilities.
- Internal MCP: submits explicitly internal feedback and monitors or reads internal, customer, or both authorized collections.

The support backend owns the authoritative feedback record and its assignment,
status, replies, notifications, and private notes. Em See Pea retrieves exact
records there rather than creating a second support inbox.

Use `defineFeedbackCollections` and `defineFeedbackCollectionSubmissions` to
create fixed-destination tools. A customer configuration declares only the
`customer` submission role and exposes `submit-customer-feedback`. An internal
configuration declares the `internal` submission role and exposes
`submit-internal-feedback`. Tool inputs cannot change the destination.

Add `defineFeedbackCollectionOperators` only to the protected internal MCP.
Its `list-feedback-submissions` tool accepts a collection and bounded page
options. Its `get-feedback-submission` tool retrieves the exact
`{ collection, submissionId }`. Each call checks collection permissions and
the authenticated account scope before returning validated feedback fields.

### Trigger operator work when feedback arrives

Configure `createFeedbackSubmittedEventsOptions` from
`@emseepea/feedback/mcp-events` with explicit monitor roles, current collection
authorization, health, and a durable [MCP Events store](/emseepea/mcp-events/).
Operators can subscribe to any of these authorized selections:

```json
{ "collections": ["internal"] }
```

```json
{ "collections": ["customer"] }
```

```json
{ "collections": ["customer", "internal"] }
```

The selection must be non-empty and unique, with at most 32 configured
collections. Discovery, subscription, refresh, and delivery independently
check current access.

After persistence, `publishFeedbackSubmittedEvent(app, event, { scope })`
publishes `feedback.submitted` with only `collection`, `submissionId`, and
`sourceEventId`. The operator retrieves the exact authoritative record before
acting on its content. Repeated publication can carry the same `sourceEventId`.

Use the same stable authenticated account scope for submission and operator
adapters and the event `ownerKey`. Collection names alone do not isolate
accounts. Resolve the account from verified authentication; do not treat an
access token or OAuth client ID as an account identity. The publisher sends
only to subscriptions owned by that scope, even when another account monitors
the same collection.

Supply a durable collection backend that enforces the scope on every operation
and cursor. Hooks are best-effort; use a transactional outbox for reliable
publication. The in-memory collection backend is process-local reference
storage. No monitor roles means no MCP Events capability.

Follow the [customer and internal configuration examples](https://github.com/emseepea/emseepea/tree/main/packages/feedback#separate-customer-and-internal-feedback)
for the complete tool and event setup and the application-owned interfaces.

## Store one-way feedback as Markdown

For an opt-in local file destination, use
`createMarkdownFeedbackSubmissionBackend({ directory })` from
`@emseepea/feedback/markdown` as the backend of `defineFeedbackSubmission`.
Use an absolute path to a dedicated folder, such as `docs/feedback` resolved
from your repository root when dogfood testing locally.

Each submission becomes a separate Markdown file. Inside a Git repository, the
adapter creates a `.gitignore` in that folder before writing feedback. The rule
ignores generated files; it does not protect already tracked or staged files,
or files force-added to Git. Check those before sharing your repository.

This destination has no team reply path. Choose a conversation backend when
users need responses.

## Add a support conversation

```ts
import { defineFeedbackConversation } from "@emseepea/feedback";
import { createGitHubFeedbackBackend } from "@emseepea/feedback/github";

const feedbackTools = defineFeedbackConversation({
  requiredScopes: ["feedback"],
  backend: createGitHubFeedbackBackend({
    owner: "your-organisation",
    repository: "support",
    token: () => getGitHubToken(),
  }),
});

const app = await createToolServer({
  additionalTools: feedbackTools,
  authentication,
});
```

Conversations are protected and client-scoped by default. Messages are
append-only. A support reply never replaces an earlier reply.

When a reply is included in a validated tool result, the backend can record
`offeredToClientAt`. This proves only that the reply was available to the AI.
It does not prove the user read or understood it, and the user does not need to
press a button or send an acknowledgement.

### Notify the AI when a team reply is ready

Protected conversations can optionally use [MCP Events](/emseepea/mcp-events/)
to prompt a subscribed AI client to read a team reply. The event includes the
account or client scope and stable IDs, not the reply text. The client should
call `get-feedback-thread` and present the reply to the person.

Set up `createFeedbackReplyEventsOptions` from
`@emseepea/feedback/mcp-events` with the same stable account or client scope
as the feedback tools. Check access to the exact thread both when subscribing
and before delivery.

After saving a team reply, call
`publishFeedbackTeamReplyEvent` from a transactional outbox (a saved queue
retried after failures) or a provider webhook whose signature, payload, scope,
and duplicate status you verify.

The one-way Markdown destination has no team reply path. Event delivery or a
reply offered to an AI does not prove that a person saw it. Test the complete
reply journey in your own client and deployment.

## Choose where support works

- PostgreSQL stores scoped threads, ordered messages, offer receipts, and an optional transactional outbox.
- Firestore stores the same model in separate scope trees with transaction-backed sequence and receipt updates.
- GitHub Issues keeps issues, comments, labels, assignees, milestones, close and reopen actions, reactions, and notifications native.
- Zendesk keeps tickets, public replies, assignment, tags, status, views, triggers, email, and private notes native. Private notes never reach the user.

GitHub and Zendesk stay authoritative. Em See Pea does not mirror them into a
second conversation database.

Use the checked webhook helpers when provider changes must trigger your event
hooks. They verify the provider signature, raw-body size, configured account or
repository, payload schema, scope, deadline, and stable delivery ID before
returning a typed event. Your application supplies the small store used to
resolve a scope hash and atomically reject duplicate events.

Use a randomly generated, high-entropy webhook secret of at least 32 UTF-8 bytes
and store it outside source control.

Configure assignment, categories, milestones, status, notifications, and email
in the provider account where you deploy the adapter.

## Send email or other events

Pass one or more feedback hooks. Each hook receives a typed event containing
stable IDs and an opaque scope, but no feedback body, email address, raw vendor
payload, request, response, credential, or provider error.

Hooks run after persistence. They are best-effort and must honor the request's
cancellation signal and deadline. For reliable email or queue delivery, use the
PostgreSQL or Firestore transactional outbox. With GitHub or Zendesk, prefer the
provider's native notifications and automation.

Read the complete [`@emseepea/feedback` API and limits](https://github.com/emseepea/emseepea/tree/main/packages/feedback).
