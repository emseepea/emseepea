# Current Release Readiness

Date: 2026-09-10

## Release Batch

- `@emseepea/server@0.5.0`
- `@emseepea/feedback@0.1.0`
- `@emseepea/testing@0.7.0`
- `@emseepea/create-api-backed-server@0.0.16`
- `@emseepea/create-database-schema-server@0.0.3`
- `@emseepea/create-html-ui-server@0.0.17`
- `@emseepea/create-mongodb-backed-server@0.0.3`
- `@emseepea/create-multi-instance-postgres-server@0.0.6`
- `@emseepea/create-progress-streaming-server@0.0.15`
- `@emseepea/create-react-ui-server@0.0.16`
- `@emseepea/create-resources-and-prompts-server@0.0.15`
- `@emseepea/create-soap-backed-server@0.0.3`
- `@emseepea/create-tool-server@0.0.17`

## Change for Users

Any Em See Pea server can add optional detailed feedback. Public one-way
submissions record useful explanations. Protected conversations preserve an
append-only support thread and bring team replies back to the AI.

Applications can use PostgreSQL, Firestore, GitHub Issues, or Zendesk. Typed
hooks connect feedback events to email, queues, webhooks, Slack, analytics, or
other application handling. Database outboxes or provider-native automation
remain the reliable notification path.

Every maintained starter now demonstrates a semantic negative control. Its
successful journey advertises the real feedback tool and proves that the AI did
not report the journey as negative feedback.

## Local Evidence Before Publication

- Tom Howard ratified ADR-0066 and the two feedback personas and jobs. Their
  human-oversight markers are confirmed and the decision compendium is current.
- TypeScript compilation, lint, package tests, non-container framework tests,
  documentation checks, and website build pass.
- Feedback adapter contract tests cover validation, deadlines, cancellation,
  scope isolation, append-only ordering, first-offer receipts, hook failure,
  and authenticated deduplicated provider event ingestion.
- A local provider-native evaluation passed all feedback cases across three
  trials and retained inspectable evidence. It covers spontaneous friction and
  notable-success recording, open disclosure, objection and duplicate controls,
  a normal empty-result control, team-reply presentation, and continued
  threaded replies. Exact-commit CI remains the publication authority.
- Independent architecture, Jobs To Be Done, Markdown accessibility, cognitive
  accessibility, and release-risk reviews are required on the final content.
- Local PostgreSQL and MongoDB integration qualification passed with fresh
  containers. Both UI browser accessibility suites and the SOAP integration
  suite also passed.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, OSV, website, package,
  standalone initializer, integration, accessibility, and performance checks.
- The standalone run must create all ten projects outside the monorepo, install
  them, and pass lint, ordinary tests, and semantic smoke tests.
- The later release job must pass every provider-native semantic example before
  publication. Semantic evaluation runs after the cheaper quality checks.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, clean installation, software bills of materials, and package
  evidence.

## Review Status

- Result: PASS.
- Final result: within appetite, subject to the required exact-commit gates.
- No package in this release batch is claimed as published by this record.
