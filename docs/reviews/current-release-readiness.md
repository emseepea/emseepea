# Current Release Readiness

Date: 2026-09-11

## Release Batch

- `@emseepea/server@0.7.0`
- `@emseepea/feedback@0.2.1`
- `@emseepea/testing@0.9.4`
- `@emseepea/react@0.0.14`
- `@emseepea/tailwind@0.0.2`
- `@emseepea/create-tool-server@0.0.21`
- `@emseepea/create-api-backed-server@0.0.19`
- `@emseepea/create-resources-and-prompts-server@0.0.18`
- `@emseepea/create-progress-streaming-server@0.0.19`
- `@emseepea/create-html-ui-server@0.0.20`
- `@emseepea/create-react-ui-server@0.0.19`
- `@emseepea/create-multi-instance-postgres-server@0.0.9`
- `@emseepea/create-database-schema-server@0.0.6`
- `@emseepea/create-mongodb-backed-server@0.0.6`
- `@emseepea/create-soap-backed-server@0.0.6`

## Change for Users

Any Em See Pea server can add optional detailed feedback. Public one-way
submissions record useful explanations. Protected conversations preserve an
append-only support thread and bring team replies back to the AI.
Successful public submissions return a bounded `nextAction` instruction to
finish the original request and disclose the specific recorded observation.

Applications can use PostgreSQL, Firestore, GitHub Issues, or Zendesk. Typed
hooks connect feedback events to email, queues, webhooks, Slack, analytics, or
other application handling. Database outboxes or provider-native automation
remain the reliable notification path.

Every maintained starter includes a negative control. It proves that ordinary
successful tool use does not trigger feedback.

Servers can set `discoverable: false` on a tool, resource, resource template, or
prompt. The capability no longer appears in discovery. A client that knows the
capability's name can still call it under the same access policy. This supports
staged retirement before later removal.

Protected tools can stream bounded progress during the POST request. Streaming
starts only after authentication and authorization succeed, and only when the
server is behind a trusted proxy.

Servers can opt into bounded, process-local resource-update subscriptions. Each
stream listens to one registered static resource URI or one concrete URI that
matches a registered resource template. The framework authenticates and
authorizes access to protected resources before server-sent events begin. It
limits active streams, event counts, event sizes, total bytes, and stream
lifetime. A limit overflow closes only the affected stream. Disconnect and
shutdown end stream work.

List-change subscriptions, resynchronisation, replay, sessions, reconnect
recovery, durability, cross-process notification delivery, framework-managed
shared stream state, and slowing producers when clients cannot keep up remain
excluded.

## Local Evidence Before Publication

- Tom Howard ratified ADR-0066, ADR-0067, ADR-0068, and the two feedback
  personas and jobs. Their human-oversight markers are confirmed and the
  decision compendium is current.
- TypeScript compilation, lint, package tests, non-container framework tests,
  documentation checks, and website build pass.
- Feedback adapter contract tests cover validation, deadlines, cancellation,
  scope isolation, append-only ordering, first-offer receipts, hook failure,
  authenticated deduplicated provider event ingestion, and the public
  `nextAction` result. Feedback semantic tests cover concise, faithful
  disclosure without requiring verbatim repetition.
- `tests/black-box/discovery-suppression.test.mjs` and
  `tests/black-box/file-discovery.test.mjs` cover hidden-but-callable and
  removed-and-uncallable behavior across the supported capability types.
- `tests/black-box/proxy-progress.test.mjs` and
  `tests/load/proxy-progress.test.mjs` cover protected progress after access
  checks and behind the trusted-proxy boundary.
- `tests/black-box/resource-subscriptions.test.mjs` covers static and concrete
  resource-template URIs, protected access, expiry, disconnect, event limits,
  and isolated overflow. `tests/load/subscription-sdk.test.mjs` covers bounded
  memory with paused readers.
- A local provider-native evaluation passed all feedback cases across three
  trials and retained inspectable evidence. It covers spontaneous friction and
  notable-success recording, open disclosure, objection and duplicate controls,
  a normal empty-result control, team-reply presentation, and continued
  threaded replies. Exact-commit continuous integration (CI) remains the
  publication authority.
- Independent architecture, Jobs To Be Done, Markdown accessibility, cognitive
  accessibility, and release-risk reviews are required on the final content.
- Local PostgreSQL and MongoDB integration qualification passed with fresh
  containers. Both UI browser accessibility suites and the SOAP integration
  suite also passed.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, Open Source Vulnerabilities
  (OSV), website, package, standalone initializer, integration, accessibility,
  and performance checks.
- The standalone run must create all ten projects outside the monorepo, install
  them, and pass lint, ordinary tests, and semantic smoke tests.
- The release job that runs after Quality must pass every provider-native
  semantic example before publication. Semantic evaluation runs after the
  cheaper quality checks.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, clean installation, software bills of materials, and package
  evidence.
- The registry-installed server smoke test must acknowledge a static-resource
  subscription and deliver an update for that exact URI.

## Review Status

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- No package in this release batch is claimed as published by this record.
