# Current Release Readiness

Date: 2026-10-05

Opt-in MCP Events webhook support has been published and a synthetic ChatGPT
Events journey has been verified. This record now covers the planned feedback
team-reply bridge. The new bridge has not been published or verified in a live
feedback conversation.

## Previously Published MCP Events Package Set

The previously published server version is 0.21.0 and feedback version is
0.5.3. Their dependent libraries and all eleven generated starters were
published with matching versions. The earlier package set remains immutable.

The package release did not include the website or Tailwind. No third-party
dependency version changes were included. Published package versions are
immutable.

The exact source Quality run `37172921662` passed. Release pull request #137
at `b41dfbfbb2c756f434b09cff4ff98e06f99f8c02` passed Release run
`37173472016` on attempt 2, including semantic checks, registry provenance,
and downloaded-package checks. Publish run `37174863657` passed. All 16
packages in that release now resolve from npm `latest`; the server's provenance
binds `@emseepea/server@0.21.0` to the release pull request head. This verifies
the published package, not a live subscriber journey.

## Planned Feedback Reply Release

The planned server patch passes an authenticated owner key to event matchers.
The feedback minor release adds an opt-in team-reply event definition and
publisher. The website patch documents setup and the evidence boundary.
React, Svelte, and testing patch versions follow their server dependency; all
eleven starters refresh generated dependencies. The exact planned npm set is:

- `@emseepea/server@0.21.1`
- `@emseepea/feedback@0.6.0`
- `@emseepea/react@0.4.4`
- `@emseepea/svelte@0.2.4`
- `@emseepea/testing@0.20.3`
- `@emseepea/create-tool-server@0.1.5`
- `@emseepea/create-api-backed-server@0.1.5`
- `@emseepea/create-openapi-backed-server@0.1.5`
- `@emseepea/create-resources-and-prompts-server@0.1.5`
- `@emseepea/create-progress-streaming-server@0.1.5`
- `@emseepea/create-html-ui-server@0.1.5`
- `@emseepea/create-react-ui-server@0.1.5`
- `@emseepea/create-multi-instance-postgres-server@0.1.5`
- `@emseepea/create-database-schema-server@0.1.5`
- `@emseepea/create-mongodb-backed-server@0.1.5`
- `@emseepea/create-soap-backed-server@0.1.5`

The planned website version is 0.0.7. It is deployed as a website artifact,
not published to npm.

## Behaviour and Local Evidence

MCP Events are disabled unless an adopter configures OAuth authentication,
event definitions, a stable owner key, authorization, health, and a durable
subscription and delivery store. The server adds authenticated event listing,
webhook subscription, and unsubscription. It verifies each HTTPS callback
before saving a subscription, checks public DNS answers and pins the selected
address, signs deliveries, rechecks access, and bounds callback waits and
delivery retries. Polling, streaming, replay, and gap/terminated notifications
are not in this release.

Historical local evidence for the previously released event package source:

- The complete local suite passed: 340 root tests, plus build, typecheck,
  example, and packed-package checks.
- Focused event and documentation checks passed: 11 tests covering opt-in
  protocol behavior, authorization, callback safety, delivery, callback
  deadlines, and current public-copy review evidence.
- Architecture and job-alignment reviews passed the implementation plan. A specialist
  cognitive-accessibility reviewer passed the exact README and both release
  notes. The risk review covered this complete package plan at a residual
  score of 5/25 for commit, push, and release.

The exact historical runs and registry readback above establish the earlier
package publication. They do not establish publication of this feedback bridge.

For the planned bridge, local package and black-box tests exercise owner
collisions on the same thread ID, team-only publication, metadata-only payloads,
exact-thread authorization, revocation before enqueue and after queueing, and
malformed event rejection. The rendered website test checks the reply guidance
and its limit. The complete exact-commit suite and release gates remain to run.

## Required Publication Evidence

- Confirm the exact Changesets package plan and pass source Quality and release
  pull-request gates without weakening initializer or provenance checks.
- Verify every planned npm package under `next`, its source/provenance binding,
  and downloaded contents before governed promotion to `latest`.
- Publish the measured website artifact and verify the deployed feedback page.
- Do not claim that a person saw a feedback reply without a live client journey.

## Conditional Release Readiness, Not Publication

The labels below apply to the planned bridge, not a shipped version. Local
behavioural and public-copy reviews pass; exact-commit Quality, release,
registry, promotion, and deployed-site checks remain pending.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Package and website publication verification: NOT COMPLETE.
