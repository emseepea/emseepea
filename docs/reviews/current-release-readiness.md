# Current Release Readiness

Date: 2026-10-04

Opt-in MCP Events webhook support has been released in the server, matching
libraries, and starter dependency versions. This record now covers the
follow-up website guide. Neither package publication nor the guide proves a
live ChatGPT event-triggered journey.

## Published Package Set

The server minor release advances its dependent libraries. All eleven starter
projects are included so their generated projects use matching dependencies.

- `@emseepea/server@0.21.0`
- `@emseepea/feedback@0.5.3`
- `@emseepea/react@0.4.3`
- `@emseepea/svelte@0.2.3`
- `@emseepea/testing@0.20.2`
- `@emseepea/create-tool-server@0.1.4`
- `@emseepea/create-api-backed-server@0.1.4`
- `@emseepea/create-openapi-backed-server@0.1.4`
- `@emseepea/create-resources-and-prompts-server@0.1.4`
- `@emseepea/create-progress-streaming-server@0.1.4`
- `@emseepea/create-html-ui-server@0.1.4`
- `@emseepea/create-react-ui-server@0.1.4`
- `@emseepea/create-multi-instance-postgres-server@0.1.4`
- `@emseepea/create-database-schema-server@0.1.4`
- `@emseepea/create-mongodb-backed-server@0.1.4`
- `@emseepea/create-soap-backed-server@0.1.4`

The package release did not include the website or Tailwind. No third-party
dependency version changes were included. Published package versions are
immutable.

The exact source Quality run `37172921662` passed. Release pull request #137
at `b41dfbfbb2c756f434b09cff4ff98e06f99f8c02` passed Release run
`37173472016` on attempt 2, including semantic checks, registry provenance,
and downloaded-package checks. Publish run `37174863657` passed. All 16
versions above now resolve from npm `latest`; the server's provenance binds
`@emseepea/server@0.21.0` to the release pull request head. This verifies
the published package, not a live subscriber journey.

## Planned Website Guide

A website-only patch changeset adds an MCP Events guide and navigation entry.
It names the OAuth prerequisite, application-supplied durable store and
authorization, webhook safety requirements, supported methods, renewal,
unsupported modes, and deployment-verification checklist. No published npm
package contents change in this follow-up.

## Behaviour and Local Evidence

MCP Events are disabled unless an adopter configures OAuth authentication,
event definitions, a stable owner key, authorization, health, and a durable
subscription and delivery store. The server adds authenticated event listing,
webhook subscription, and unsubscription. It verifies each HTTPS callback
before saving a subscription, checks public DNS answers and pins the selected
address, signs deliveries, rechecks access, and bounds callback waits and
delivery retries. Polling, streaming, replay, and gap/terminated notifications
are not in this release.

Local evidence for the released package source:

- The complete local suite passed: 340 root tests, plus build, typecheck,
  example, and packed-package checks.
- Focused event and documentation checks passed: 11 tests covering opt-in
  protocol behavior, authorization, callback safety, delivery, callback
  deadlines, and current public-copy review evidence.
- Architecture and JTBD reviews passed the implementation plan. A specialist
  cognitive-accessibility reviewer passed the exact README and both release
  notes. The risk review covered this complete package plan at a residual
  score of 5/25 for commit, push, and release.

The exact runs and registry readback above establish package publication. The
local checks alone did not establish that, and no adopter production journey
has been verified.

## Required Website Publication Evidence

- Confirm the website-only Changesets plan and exact source Quality run.
- Pass the measured website build, accessible rendered-page and navigation
  checks, and release-head gates.
- Publish the measured website artifact and verify the deployed MCP Events
  guide, its links, and its current-page navigation directly.
- Keep live ChatGPT event-triggered claims separate until a real subscribed
  client journey is verified.

## Conditional Website Readiness, Not Publication

The labels below describe the local website guide and reviewed copy. The
documentation-slice risk review scored commit, push, and release at 5/25,
within the project's appetite. The website changes have not passed
exact-commit Quality or deployed-site checks.

- Result: PASS
- Final result: within appetite, subject to exact-commit and deployment gates.
- Website deployment verification: NOT COMPLETE.
