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

The repository qualifies these adapters with deterministic HTTP contract tests,
not a live customer account. Qualify assignment, categories, milestones,
statuses, notifications, and email in the provider account where you deploy
them.

## Send email or other events

Pass one or more feedback hooks. Each hook receives a typed event containing
stable IDs and an opaque scope, but no feedback body, email address, raw vendor
payload, request, response, credential, or provider error.

Hooks run after persistence. They are best-effort and must honor the request's
cancellation signal and deadline. For reliable email or queue delivery, use the
PostgreSQL or Firestore transactional outbox. With GitHub or Zendesk, prefer the
provider's native notifications and automation.

Read the complete [`@emseepea/feedback` API and limits](https://github.com/emseepea/emseepea/tree/main/packages/feedback).
