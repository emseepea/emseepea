# Current Release Readiness

Date: 2026-10-04

This plan covers opt-in MCP Events webhook support in the server, matching
libraries, and starter dependency versions. It is not a publication or a
verified production ChatGPT event-triggered journey.

## Planned Package Set

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

No website or Tailwind package release is planned. No third-party dependency
version changes are included. Published package versions remain immutable.

## Behaviour and Local Evidence

MCP Events are disabled unless an adopter configures OAuth authentication,
event definitions, a stable owner key, authorization, health, and a durable
subscription and delivery store. The server adds authenticated event listing,
webhook subscription, and unsubscription. It verifies each HTTPS callback
before saving a subscription, checks public DNS answers and pins the selected
address, signs deliveries, rechecks access, and bounds callback waits and
delivery retries. Polling, streaming, replay, and gap/terminated notifications
are not in this release.

Local evidence for the current source candidate:

- The complete local suite passed: 340 root tests, plus build, typecheck,
  example, and packed-package checks.
- Focused event and documentation checks passed: 11 tests covering opt-in
  protocol behavior, authorization, callback safety, delivery, callback
  deadlines, and current public-copy review evidence.
- Architecture and JTBD reviews passed the implementation plan. A specialist
  cognitive-accessibility reviewer passed the exact README and both release
  notes. The risk review covered this complete package plan at a residual
  score of 5/25 for commit, push, and release.

These local checks do not establish a successful Quality run, release-head
build, registry publication, or adopter production journey.

## Required Publication Evidence

- Check the complete Changesets plan against these exact package versions.
- Qualify the exact committed source and pass its watched Quality run.
- Verify that the release pull request contains only generated package changes.
- Pass exact release-head semantic, packed-package and dependency gates.
- Verify registry versions, contents, and provenance before promotion.
- Exercise the registry-published server event boundary before reporting
  package verification. An adopter's live ChatGPT trigger needs separate proof.

## Conditional Readiness, Not Publication

The labels below describe this bounded source plan. They do not assert that
the required release-head checks or publication have completed.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.
