# `@emseepea/feedback`

Em See Pea is beta. [Maturity and support](https://github.com/emseepea/emseepea/blob/main/SUPPORT.md#maturity-and-support)
defines the limits of that label.

Add detailed feedback or a durable support conversation to any Em See Pea
server. The package is optional. Generated applications do not configure it.

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

## Offer Website Feedback through WebMCP (Experimental)

Use `@emseepea/feedback/webmcp` to offer one existing MCP feedback tool to a
website's browser agent. It forwards submissions through your connected MCP
client to the same server and authoritative backend. It does not create a
second feedback service or a website login integration.

```ts
import { registerFeedbackWebMcp } from "@emseepea/feedback/webmcp";

// client is your already-connected official MCP client.
const feedback = await registerFeedbackWebMcp({ client });

// Dispose before logout, account changes, or replacing the client.
function removeFeedback() {
  if (feedback.available) feedback.dispose();
}
```

Your application owns the client, its allowed endpoint, authentication and
lifetime. The adapter never closes it. The server still checks authorization,
account scope and input, including any bounded application-declared context.
It does not automatically capture the DOM, URL, chat, credentials or page state.

Registration defaults to `submit-feedback`. Use trusted deployment
configuration to select a fixed collection tool, for example
`toolName: "submit-customer-feedback"`. Never let an agent or user input select
the destination. The adapter registers no operator or event tools.

The options are `{ client, modelContext?, toolName?, signal?, timeoutMs? }`:

- `modelContext` defaults to experimental `document.modelContext`. When absent,
  registration returns `{ available: false }`; the website can keep its usual
  feedback UI. Other registration failures reject with a safe error.
- `signal` ends the registration lifetime. `dispose()` cancels pending work and
  removes this registration. Dispose before logout or account/client changes.
- `timeoutMs` defaults to 10,000 and accepts integers from 1 to 60,000. Discovery
  and calls have bounded deadlines. Discovery traverses at most eight catalogue
  pages once per registration; it does not poll the server.

The server's input schema and active description are preserved. Guidance
encourages agents to record notable helpful, difficult, surprising or wrong
experiences without an extra permission question, disclose the specific feedback
in the same response, respect objections, avoid duplicates and routine reports,
and complete the original task.

Successful results retain the receipt and
`nextAction`. Propagating this guidance does not establish that a browser agent
will follow it; native browser-agent semantic qualification remains required.

Only one submission may be in flight. Each execution dispatches at most one
MCP call and never automatically retries. A timeout, cancellation or missing
receipt can leave persistence unknown: feedback may already have been saved.
Do not claim it was recorded or retry automatically. Cancellation does not
prove rollback.

An existing WebMCP tool with the selected name is a registration
error; the adapter does not replace tools it does not own.

WebMCP is experimental. This adapter targets the `document.modelContext` API
shape exercised in Chromium 154; that does not establish support in other
browsers or agents, or guarantee compatibility with later API revisions.

### Run the synthetic website example

From a repository checkout with dependencies installed:

```sh
npm run build
node packages/feedback/demo-webmcp/server.mjs
```

Follow [Chrome's WebMCP setup guide](https://developer.chrome.com/docs/ai/webmcp#get-started)
to enable the experimental API, then open the printed loopback URL. The example
bundles the official browser MCP client with esbuild and uses the same HTTP
server an independent MCP client can connect to.

It uses synthetic data and
process-local storage, cleared when the server stops. Its public demo does not
implement login. Use server-derived account scope and your existing client
authentication for a protected deployment.

### Qualify the native WebMCP path

After building, run the optional semantic cases with an explicitly chosen,
available Codex model:

```sh
GITHUB_SHA="$(git rev-parse HEAD)" EMSEEPEA_CODEX_MODEL="chosen-model" node packages/testing/semantic/cli.mjs --provider codex-local --output artifacts/webmcp-eval.json packages/feedback/eval-webmcp/meaning.test.mjs
```

Replace `chosen-model` before running. The fixture requires Chromium with the
native WebMCP API; set `WEBMCP_CHROMIUM_PATH` if a specific executable is needed.

The tested path is Codex or Claude CLI → one loopback MCP browser bridge →
native Chromium WebMCP → the actual demo task and feedback adapter/backend.
The model sees only page-registered application tools. Playwright stays inside
the fixture; the model receives no browser automation tools.

The existing harness uses three fresh trials, unchanged user messages, native
provider tool events and three independent tool-free judgments for each meaning
assertion, without semantic retries or model coaching. Correlation checks tie
calls to native results, visible task state and backend writes.

Choose an unused semantic output filename for each run and preserve previous
results. Each invocation logs a fresh private `run-...` directory under
`artifacts/webmcp-native`. Collect only that named directory. Its manifests bind
run, source SHA-256, case and trial identity. Independently verify the clean
checkout: a supplied revision is caller-reported; an absent revision is explicit.

Bounded synthetic native execution files remain available after failed startup,
turns or assertions. The four cases retain at most 12 MiB of raw native evidence,
plus bounded manifests and checkpoints. Missing or partial files do not prove
that no call or write occurred. No provider logs, credentials or browser storage
are collected by this fixture.

Successful native verification writes an immutable numbered checkpoint. It
covers its stated call counts and exact byte hashes, and does not verify later
appended activity. Match its run and source with the complete semantic result;
native correlation alone is insufficient. Legacy flat summary files and other
run directories are not evidence for the current invocation.

Missing model, native API or evidence fails closed. No semantic pass is claimed
here. Local Codex evidence is scoped to this path and does not replace
credentialed Claude release checks or establish Chrome built-in-agent
compatibility.

## Separate Customer and Internal Feedback

A collection is a deployment-configured authorization partition, such as
`customer` or `internal`. It identifies the feedback destination, not an
account or person. Declare submission, monitoring, and operator roles
separately; declaring a collection grants none of those roles automatically.

| Deployment | Submission destination | Monitoring and retrieval |
| --- | --- | --- |
| Customer-facing MCP | `customer` only | None |
| Internal MCP | Explicitly `internal` | Protected access to `internal`, `customer`, or both authorized collections |

The support backend owns the authoritative record, assignment, status,
replies, notifications, and private notes. Em See Pea reads and writes exact
records there; it does not create a second support inbox.

Use the same stable account scope for submission and operator adapters and
the MCP Events `ownerKey`. Resolve it from verified authentication. Do not use
an access token or assume an OAuth client ID identifies an account. Two
accounts using the same collection remain separate.

### Configure customer submission only

The imports from `./feedback-integration.js` are application code you provide.
`feedbackBackend` implements `FeedbackCollectionSubmissionBackend` over your
durable support storage. It enforces `context.scope` on every write, list,
lookup, and cursor.

`accountScopeForPrincipal` resolves the authenticated account. `authentication`
supplies your checked OAuth verifier and metadata.

```ts
import {
  defineFeedbackCollections,
  defineFeedbackCollectionSubmissions,
} from "@emseepea/feedback";
import { createEmseepea } from "@emseepea/server";
import {
  authentication, feedbackBackend, accountScopeForPrincipal,
} from "./feedback-integration.js";

const customer = defineFeedbackCollections({
  collections: ["customer"],
  submissions: [{
    collection: "customer", access: "protected",
    requiredScopes: ["feedback:submit"],
  }],
});

const app = createEmseepea({
  name: "customer-feedback", version: "1.0.0", authentication,
  tools: defineFeedbackCollectionSubmissions({
    definition: customer,
    scope: accountScopeForPrincipal,
    backend: feedbackBackend,
  }),
});
```

This exposes `submit-customer-feedback` with a fixed destination. The caller
cannot select a collection. It exposes no operator tools or MCP Events.
If anonymous submission is intentional, declare `access: "public"` without
`requiredScopes` and provide a fixed, application-owned storage scope.

### Configure internal submission and protected operators

The application module below also supplies a durable `eventStore`, its
`eventSystemHealthy` check, and `accountScopeForAuth` using the same account
projection as `accountScopeForPrincipal`. `canMonitorCollection` checks the
owner's current permission for the collection and requested lifecycle phase.

Enforce the declared monitor scopes in that callback; the helper does not
infer grants from the role declaration.

```ts
import {
  defineFeedbackCollections,
  defineFeedbackCollectionSubmissions,
  defineFeedbackCollectionOperators,
} from "@emseepea/feedback";
import {
  createFeedbackSubmittedEventsOptions,
  publishFeedbackSubmittedEvent,
} from "@emseepea/feedback/mcp-events";
import { createEmseepea } from "@emseepea/server";
import {
  authentication, feedbackBackend, accountScopeForPrincipal,
  accountScopeForAuth, canMonitorCollection, eventStore, eventSystemHealthy,
} from "./feedback-integration.js";

const internal = defineFeedbackCollections({
  collections: ["customer", "internal"],
  submissions: [{
    collection: "internal", access: "protected",
    requiredScopes: ["feedback:submit:internal"],
  }],
  operators: [
    { collection: "internal", access: "protected",
      requiredScopes: ["feedback:operator", "feedback:read:internal"] },
    { collection: "customer", access: "protected",
      requiredScopes: ["feedback:operator", "feedback:read:customer"] },
  ],
  monitors: [
    { collection: "internal", access: "protected",
      requiredScopes: ["feedback:monitor:internal"] },
    { collection: "customer", access: "protected",
      requiredScopes: ["feedback:monitor:customer"] },
  ],
});

const events = createFeedbackSubmittedEventsOptions({
  definition: internal,
  ownerKey: accountScopeForAuth,
  canMonitorCollection,
  health: eventSystemHealthy,
  store: eventStore,
});

let app: ReturnType<typeof createEmseepea>;
app = createEmseepea({
  name: "internal-feedback", version: "1.0.0", authentication, events,
  tools: [
    ...defineFeedbackCollectionSubmissions({
      definition: internal,
      scope: accountScopeForPrincipal,
      backend: feedbackBackend,
      hooks: [(event, context) => publishFeedbackSubmittedEvent(app, event, context)
        .then(() => undefined)],
    }),
    ...defineFeedbackCollectionOperators({
      definition: internal,
      scope: accountScopeForPrincipal,
      backend: feedbackBackend,
    }),
  ],
});
```

The internal submission tool is `submit-internal-feedback`. Operator roles
must share a tool-entry scope, here `feedback:operator`. Each call also checks
every scope for its selected collection before accessing the backend.
Use protected tool discovery when operator names and schemas must be hidden.

Hooks run after persistence and are best-effort. For reliable notification,
save the recorded event and its account scope in a transactional outbox and
call `publishFeedbackSubmittedEvent(app, event, { scope })` from your worker.
The publisher targets only subscriptions whose `ownerKey` equals that scope.
Keep the scope in trusted storage, outside the delivered payload.

### Read and monitor exact submissions

`list-feedback-submissions` accepts `{ collection, cursor?, limit? }`.
The limit defaults to 20 and cannot exceed 50. Pass the returned `nextCursor`
unchanged for the next page in the same collection and account scope.
`get-feedback-submission` accepts the exact `{ collection, submissionId }`.
Unknown, unauthorized, and mismatched records return the same public error.

Results contain `collection`, `submissionId`, `observation`, `detail`, and
`recordedAt`. Supply `contextSchema` to both tool builders to accept and return
validated application context. Backend `source` and authorization `scope`
are excluded; results cannot exceed 256 KiB.

Discover `feedback.submitted` with `events/list`, then subscribe using one of
these argument sets:

```json
{ "collections": ["internal"] }
```

```json
{ "collections": ["customer"] }
```

```json
{ "collections": ["customer", "internal"] }
```

Use only currently authorized collections. The selection must be non-empty,
unique, and no larger than 32 configured monitor collections. It is sorted
before subscription identity is calculated. Discovery, subscription, refresh,
and delivery each recheck authorization; delivery also rechecks queued work.

The payload is exactly `{ collection, submissionId, sourceEventId }`.
Retrieve the authoritative record with `get-feedback-submission` before
acting on it. Use `sourceEventId` to recognize repeated publication. Configure
callback verification and a durable delivery store as described in the
[MCP Events guide](https://emseepea.github.io/emseepea/mcp-events/).

`createFeedbackSubmittedEventsOptions` returns `undefined` when no monitor
role exists. The included `createInMemoryFeedbackCollectionBackend` is
process-local reference storage; supply a durable collection backend for
deployment. Existing conversation adapters retain their conversation APIs.

## Add a Protected Support Conversation

```ts
import {
  defineFeedbackConversation,
  defineFeedbackSubmission,
} from "@emseepea/feedback";
import { createGitHubFeedbackBackend } from "@emseepea/feedback/github";
import { createEmseepea } from "@emseepea/server";

const feedbackBackend = createGitHubFeedbackBackend({
  owner: "your-organisation",
  repository: "support",
  token: () => getGitHubToken(),
});
const feedbackScope = (principal) => accountScopeForPrincipal(principal);
const feedbackHooks = [sendFeedbackEvent];
const feedbackTools = [
  defineFeedbackSubmission({
    access: "protected",
    requiredScopes: ["feedback"],
    scope: feedbackScope,
    backend: {
      async submit({ observation, detail }, context) {
        const result = await feedbackBackend.createThread({
          subject: observation,
          message: detail,
        }, context);
        return {
          id: result.conversation.id,
          recordedAt: result.conversation.createdAt,
          events: result.events,
        };
      },
    },
    hooks: feedbackHooks,
  }),
  ...defineFeedbackConversation({
    requiredScopes: ["feedback"],
    scope: feedbackScope,
    backend: feedbackBackend,
    hooks: feedbackHooks,
  }),
];

const app = createEmseepea({
  name: "pea-guide",
  version: "1.0.0",
  tools: applicationTools,
  additionalTools: feedbackTools,
  authentication,
});
```

The three tools append a user reply, list scoped threads, and read one exact
thread. Use `defineFeedbackSubmission` and `submit-feedback` to create every new
feedback conversation. The returned submission ID is the canonical thread ID
for reply and get operations. List returns the thread when both helpers use the
same authorized scope projection.

`create-feedback-thread` has been removed. Existing stored thread IDs remain
valid for reply and get operations, and those threads remain available in list
results.

Legacy callers should set the required `observation` field to one of the
allowed category values. Set `detail` to
`Subject: <subject>\n\n<message>`.

The complete constructed `detail` value, including the prefix and line breaks,
must not exceed 4,000 characters. The framework rejects an over-limit `detail`
value and does not truncate the subject or message content.

The submission result provides the stable thread ID and recording time rather
than the full newly created conversation.

Conversations are protected and default to the framework-normalized OAuth
client ID as their scope. Supply the same `scope(principal)` mapping to both
helpers when your application has a safer account-level projection.

A public submission's default `public` scope does not automatically match a
protected conversation's client-derived default. Do not pass tokens, raw
provider claims, or credentials as a scope.

Messages are append-only and ordered by stable sequence numbers. Reading a
thread may record `offeredToClientAt` on a team reply. That timestamp means the
reply was included in a validated MCP tool result available to the AI. It does
not prove the user read or understood it. No acknowledgement button or reply is
required.

## Match Annotations to Composed Effects

Override feedback tool annotations when your backend or hooks change a tool's
effects. Existing defaults remain unchanged.

```ts
const submission = defineFeedbackSubmission({
  access: "public",
  annotations: { destructiveHint: true },
  backend: feedbackBackend,
  hooks: [sendSubmissionEmail],
});

const conversations = defineFeedbackConversation({
  requiredScopes: ["feedback"],
  annotations: {
    reply: { destructiveHint: true },
    list: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    get: {
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  backend: conversationBackend,
  hooks: [sendConversationEmail],
});
```

Classify the complete operation, not only the feedback package's built-in
persistence step. Include backend writes, lifecycle hooks, queues,
notifications, and external services.

- A `list` or `get` operation that changes lifecycle state is not read-only.
  Set `readOnlyHint: false`.
- If the operation cancels notification state, set `destructiveHint: true`.
- If repeating the operation can produce a different state transition, set
  `idempotentHint: false`.
- A `reply` or submission operation that can send email must set
  `destructiveHint: true`.
- Set `openWorldHint` to `true` when the complete operation can interact with
  an external domain beyond the operation’s declared bounds. Otherwise set
  it to `false`.

Internet connectivity alone does not make an operation open-world. A bounded
private account can remain closed-world even when it uses a remote service.

Overrides accept only the four boolean flags shown above. Omitted or
`undefined` flags retain current defaults. Invalid flag values or operation
keys fail at definition time, and later mutation does not change discovery.
The exported types are `FeedbackToolAnnotationOverrides` and
`FeedbackConversationAnnotationOverrides`. Collection and operator helpers
keep their existing annotation contracts.

Tool annotations help MCP clients describe and confirm an operation. They do
not grant access or replace authentication and authorization. MCP discovery
reports each configured override while unchanged operations keep the package
defaults.

## Choose a Backend

### Markdown files (one-way submissions)

`createMarkdownFeedbackSubmissionBackend({ directory })` stores each one-way
submission as a separate Markdown file in a configurable local directory. Pass
it to `defineFeedbackSubmission`; it does not implement protected conversations
or a team reply path. No generated application enables this option by default.

```ts
import { resolve } from "node:path";
import { createMarkdownFeedbackSubmissionBackend } from "@emseepea/feedback/markdown";

const backend = createMarkdownFeedbackSubmissionBackend({
  directory: resolve("docs/feedback"),
});
```

The directory must be absolute and on a trusted local filesystem that supports
directory syncing. Use a dedicated feedback folder, such as `docs/feedback`
when running locally from the repository root. Scope values become SHA-256
directory names; generated IDs become filenames. The adapter rejects symlinks
at the configured and scope directories and creates private scope directories
and files.

When the folder is inside a Git repository, the adapter creates and checks a
`.gitignore` there before storing feedback. It ignores generated feedback files
but leaves the `.gitignore` visible to Git. The adapter rejects a general docs
folder containing other files.

The ignore rule does not protect feedback that was already tracked or staged,
or files added with `git add -f`. Check those separately before sharing the
repository.

A successful call means the file and its directory entry were synced before the
receipt and event were returned. The adapter does not commit files to Git, send
notifications, or provide shared storage across instances. Include feedback
only in backups or exports approved for that content. Treat feedback prose and
application-declared context as untrusted, even when displayed as Markdown.

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

#### Cross-instance resource update hints

`createPostgresFeedbackUpdateConsumer` from `@emseepea/feedback/postgres`
provides durable, scoped outbox consumption for each serving instance.
An acknowledgement records that one consumer has handled one event.

Run
`migratePostgresFeedback(pool)` to add its receipt table and index, and enable
`outbox: true` on **every writer**, including team-reply workers. No change to
`@emseepea/server` is required.

```ts
import { createPostgresFeedbackUpdateConsumer } from "@emseepea/feedback/postgres";
import { notifyResourceUpdated } from "@emseepea/server";

const consumer = createPostgresFeedbackUpdateConsumer({
  pool,
  consumerId: servingInstanceId, // Stable across reconnects; unique per independent instance.
  scope: authorizedAccountScope,
  batchSize: 200,
});

// Call on startup, periodically, and after reconnecting. Retry rejected calls
// with this same consumer identity. These application functions enforce current
// authorization, retention/deletion policy, and construct a scope-specific URI.
async function drainUpdates() {
  while (await consumer.consume(async (event) => {
    if (!await mayNotifyCurrentSubscribers(event)) return;
    notifyResourceUpdated(app, feedbackResourceUri(event.scope, event.threadId));
  })) { /* Continue until the pending backlog is empty. */ }
}
```

The application owns scheduling, shutdown, connection/query timeouts, callback
timeouts, and retry backoff. The consumer owns durable progress; applications
do not need to implement a cursor, overlap window, claim protocol, or receipt
store. Schedule another poll even after an empty batch: transactions may commit
later. Stop scheduling and await in-flight calls before closing the pool.

##### Delivery and recovery

Each retained, committed `feedback.thread.created`, `feedback.message.added`,
or `feedback.status.changed` event remains eligible until its callback succeeds
and its individual acknowledgement is persisted. Earlier successful callbacks
stay acknowledged if a later callback fails. Database errors and rejected
callbacks reject `consume`; retrying recovers pending events.

A crash or acknowledgement failure after a successful callback can repeat that
callback. Use the stable event `id` for optional deduplication; callbacks must
tolerate duplicates. No ordering, exclusivity, or exactly-once delivery is
promised. Concurrent calls for the same identity can duplicate work.

##### Late commits and batches

Queries select all unacknowledged events, without a timestamp or sequence
watermark. `occurredAt` only orders each bounded batch; it is not a commit-order
cursor. A transaction committed after an empty poll remains eligible for the
next poll, regardless of its timestamp.

`consume` returns the number acknowledged (up to `batchSize`, default 200,
maximum 1000). An error rejects the call rather than returning a partial count.

##### Independent consumers

Receipts are keyed by exact `scope`, `consumerId`, and event `id`. Give each
instance holding independent subscriptions a distinct identity. A restarted
instance can reuse its identity; a new identity replays all retained events on
first use. There is no implicit “start now” watermark.

Resource reads remain authoritative; hints are not durable proof that a client
received a notification. Refresh resource state when establishing a new MCP
subscription, including after an instance restarts.

##### Isolation and policy

Create a consumer only for an authorized exact scope. Payloads contain
identifiers, type, timestamp, scope, and optional author, never feedback
content. Recheck current permissions and retention/deletion rules before
notifying.

Returning normally deliberately acknowledges a skipped hint; throw for a
temporary policy-check or notification failure to retry it. First-offer receipt
events are excluded to avoid read/notification loops.

##### Dispatcher independence and cleanup

Consumption neither reads nor updates `dispatched_at`. Email dispatch must
retain outbox rows until every consumer that needs them has acknowledged them.
There is no automatic expiration or outbox deletion. Deleting an unacknowledged
event loses its hint; deleting a receipt for a retained event makes it eligible
again.

After stopping a retired consumer, `await consumer.forget()` deletes only its
scoped receipts. Reusing that identity then replays retained events. Applications
own outbox retention and may delete orphaned receipts after their corresponding
events are removed.

##### Backend support

This API supports the PostgreSQL conversation/submission outbox only. It does
not consume collection-backend MCP Events or provide equivalent delivery
guarantees for Firestore, Markdown, GitHub, or Zendesk. It requires no dedicated
LISTEN connection, and works through ordinary pooled queries.

Under sustained arrivals or a permanently failing callback, progress requires
sufficient polling capacity or resolving the failure; a batch cannot bypass a
failing earlier callback automatically.

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

Configure assignment, categories, milestones, status, notifications, and email
in the provider account where you deploy the adapter.

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

### Notify an AI client about a team reply

A protected conversation can optionally use MCP Events to tell a subscribed AI
client that a team reply is ready. The event carries only the account or client
scope and stable thread, message, and source-event IDs. It does not carry the
reply text. The client should call `get-feedback-thread` and present the reply
to the person.

1. Configure `createFeedbackReplyEventsOptions` from
   `@emseepea/feedback/mcp-events` as the server's `events` option. Use the same
   stable account or client scope for its `ownerKey` as for
   `defineFeedbackConversation({ scope })`.
2. Supply `canReadThread(ownerKey, threadId)` to check access to the exact
   thread. The check runs when subscribing and again before delivery. Supply
   your durable MCP Events store and health check as described in the
   [MCP Events guide](https://emseepea.github.io/emseepea/mcp-events/).
3. After saving a team reply, pass its typed feedback event to
   `publishFeedbackTeamReplyEvent(app, event)`. For PostgreSQL or Firestore,
   publish from the transactional outbox: a saved queue that can be retried
   after failures. For GitHub or Zendesk, use the checked provider webhook.
   The helper ignores non-team events and publishes only a reference to a team
   message.

An outbox retry can publish the same reply more than once. Use the stable
`sourceEventId` in the event payload to recognise duplicates.

The Markdown destination is one-way and has no team reply to announce. An
event delivery, or a reply being offered to an AI client, does not prove a
person saw it. Test the complete reply journey in your own client and
deployment before relying on it.

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
