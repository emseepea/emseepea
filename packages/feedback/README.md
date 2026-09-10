# `@emseepea/feedback`

Add detailed feedback or a durable support conversation to any Em See Pea
server. The package is optional. Generated applications do not configure it.
Their semantic tests install it only as a development dependency so successful
example journeys can prove that the AI did not record negative feedback.

Use a submission when the team only needs one useful observation. Use a
conversation when the team must reply and the AI must bring that reply back to
the user.

## Record One Detailed Observation

```ts
import { defineFeedbackSubmission } from "@emseepea/feedback";
import { createPostgresFeedbackSubmissionBackend } from "@emseepea/feedback/postgres";
import { createEmseepea } from "@emseepea/server";
import { z } from "zod";

const feedback = defineFeedbackSubmission({
  access: "public",
  scope: "pea-guide",
  contextSchema: z.strictObject({
    feature: z.string().max(80).describe("Feature involved in the observation."),
  }),
  backend: createPostgresFeedbackSubmissionBackend({ pool }),
});

const app = createEmseepea({
  name: "pea-guide",
  version: "1.0.0",
  tools: applicationTools,
  additionalTools: [feedback],
});
```

The tool records one category and bounded explanatory prose. It can also accept
application-declared structured context. It never captures the surrounding
conversation, raw tool requests or results, credentials, or application data
automatically.

Its model-facing description covers errors, friction, annoyance, unnecessary
difficulty, confusion, repetition, surprising good or bad outcomes, capability
mismatches, suggestions, and notable success. It tells the AI to:

- record one notable observation without asking a separate permission question
- openly tell the user in the same response what it recorded
- avoid normal uneventful operation, expected empty results, and duplicates
- stop recording if the user objects

The successful structured result includes `nextAction`. It reminds the AI to
finish every part of the user's original request before briefly stating the
specific feedback recorded. A routine successful tool call, structured result,
or expected number of steps is not feedback-worthy.

These are instructions for the AI, not server-enforced guarantees. Qualify the
behaviour with a native semantic test for every AI client you support.

## Add a Protected Support Conversation

```ts
import { defineFeedbackConversation } from "@emseepea/feedback";
import { createGitHubFeedbackBackend } from "@emseepea/feedback/github";
import { createEmseepea } from "@emseepea/server";

const feedbackTools = defineFeedbackConversation({
  requiredScopes: ["feedback"],
  backend: createGitHubFeedbackBackend({
    owner: "your-organisation",
    repository: "support",
    token: () => getGitHubToken(),
  }),
  hooks: [sendFeedbackEvent],
});

const app = createEmseepea({
  name: "pea-guide",
  version: "1.0.0",
  tools: applicationTools,
  additionalTools: feedbackTools,
  authentication,
});
```

The four tools create a thread, append a user reply, list scoped threads, and
read one exact thread. Conversations are protected and default to the
framework-normalized OAuth client ID as their scope. Supply `scope(principal)`
when your application has a safer account-level projection. Do not pass tokens,
raw provider claims, or credentials as a scope.

Messages are append-only and ordered by stable sequence numbers. Reading a
thread may record `offeredToClientAt` on a team reply. That timestamp means the
reply was included in a validated MCP tool result available to the AI. It does
not prove the user read or understood it. No acknowledgement button or reply is
required.

## Choose a Backend

### PostgreSQL

Run `migratePostgresFeedback(pool)` once during controlled setup, then use
`createPostgresFeedbackBackend({ pool })`. The adapter uses transactions, row
locks, scope-qualified keys, append-only messages, and a unique first-offer
update. `appendPostgresTeamReply` is the checked team-side write helper.

Set `outbox: true` to write typed events to
`emseepea_feedback_outbox` in the same transaction as the feedback change. An
application worker can claim those rows, send email or queue work, and set
`dispatched_at`. Em See Pea does not prescribe a queue, retry schedule, or mail
provider.

### Firestore

Pass an initialized `@google-cloud/firestore` database to
`createFirestoreFeedbackBackend({ database })`. The package uses the small
common Firestore transaction and collection surface without taking a runtime
dependency on Google's SDK. Scope hashes select separate document trees.

`appendFirestoreTeamReply` provides a checked team-side write. Set
`outbox: true` to write event documents with the feedback transaction. Your
application owns delivery and retry.

### GitHub Issues

`createGitHubFeedbackBackend` keeps GitHub authoritative:

- a thread is an issue
- later user messages and team replies are comments
- support staff use native labels, assignees, milestones, close, and reopen
- an eyes reaction on the exact support comment records the first client offer
- normal GitHub notifications and email remain available

Use a private support repository when feedback is sensitive. The adapter uses
hashed scope labels and exact issue and comment IDs. It never locates an issue
by title.

### Zendesk

`createZendeskFeedbackBackend` keeps Zendesk authoritative:

- a thread is a ticket
- user and team messages are public comments
- agents use native assignment, tags, status, views, triggers, and email
- a private note on the exact public team comment records the first client offer
- private agent notes never enter the MCP conversation

Use an OAuth bearer token through the `token` option. The adapter scopes tickets
with a hashed tag and always reopens the exact ticket ID returned by Zendesk.

GitHub and Zendesk are polled through their authenticated APIs when a client
lists or reads feedback. Provider response shapes cross runtime validation
before they become feedback data. Native provider notifications are preferred
for reliable email.

Use `ingestGitHubFeedbackWebhook` or `ingestZendeskFeedbackWebhook` from
`@emseepea/feedback/webhooks` to turn provider changes into typed events. The
caller supplies:

- raw body bytes and lower-case provider headers
- a randomly generated, high-entropy secret of at least 32 UTF-8 bytes, stored
  outside source control, and the configured destination
- a store that resolves scope hashes and atomically claims stable delivery or
  audit IDs

The boundary verifies the signature, 64 KiB size limit, destination, payload
schema, scope, deadline, and duplicate status before returning an event.
Configure Zendesk's webhook body to match the documented `eventId`, `subdomain`,
`ticketId`, `scopeTag`, `occurredAt`, and `change` shape exported by the
TypeScript API.

The included GitHub and Zendesk checks are deterministic HTTP contract tests,
not evidence from a live customer account. Provider-native assignment,
categorisation, milestone, status, notification, and email behavior remains the
provider's responsibility and must be qualified in the account where you deploy
the adapter.

## Handle Feedback Events

Hooks receive references, not feedback content:

```ts
async function sendFeedbackEvent(event, { signal, deadlineMs }) {
  await queue.send({
    id: event.id,
    type: event.type,
    threadId: event.threadId,
    messageId: event.messageId,
  }, { signal, deadlineMs });
}
```

The event vocabulary is limited to thread creation, message addition, status
change, and message offer. Events contain an opaque scope and stable IDs. They
contain no feedback body, summary, email address, recipient, vendor payload,
credentials, request, response, or provider error.

Hooks run after durable state succeeds and receive the request's cancellation
signal and absolute deadline. They are best-effort, have no framework retry,
and cannot change the MCP result. Hook code must honor that signal and deadline.
For reliable delivery, use the PostgreSQL or Firestore outbox, or GitHub and
Zendesk native automation.

## Effect and Retry Limits

Creating a thread, submitting feedback, and appending a message are
non-idempotent. Em See Pea does not retry them. A client retry can create a
duplicate unless your backend atomically deduplicates a stable operation ID that
the model cannot supply or alter.

Reading a conversation can write the first-offer receipt. PostgreSQL and
Firestore claim that receipt atomically, and GitHub uses the provider's
idempotent reaction endpoint.

Zendesk private receipt notes are best-effort and can duplicate when clients
read concurrently; their stable message marker lets application automation
deduplicate them. Receipt failure never hides a support reply from the AI.

The package makes no claim that an AI will always record feedback, avoid
duplicates, present a reply, or honor an objection. Native semantic tests
provide evidence only for the tested client, model, prompts, and revision.
