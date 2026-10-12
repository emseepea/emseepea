# Current Release Readiness

Date: 2026-10-12

## Release status

Publication status: **NOT READY**.

The source implementation and focused package checks pass. Publication remains
pending until the final source commit passes the repository's Quality, Release,
Publish, registry, installed-package, merge-back, and clean-checkout gates.

The repository's release verifier requires the next two machine-readable
markers. They record only the current source review result; they do not mean
that the package is published.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Local focused verification: **PASS**.
- Architecture review: **PASS**.
- Jobs To Be Done review: **PASS**.
- Cognitive-accessibility review: **PASS** for the recorded source hashes.
- Release-risk review: required for the final source commit before release.

## Feedback creation tool consolidation

`submit-feedback` is the sole Model Context Protocol (MCP) operation for
creating new feedback.
`defineFeedbackConversation` now exposes exactly three MCP tools:
`reply-to-feedback-thread`, `list-feedback-threads`, and
`get-feedback-thread`. The removed `create-feedback-thread` operation is not
discoverable, callable, aliased, or configurable.

The internal backend `createThread` operation remains available to submission
adapters. Existing stored threads, identifiers, owner scopes, replies, events,
hooks, receipts, deadlines, and cancellation behavior remain unchanged.

Adopters creating durable conversations configure `defineFeedbackSubmission`
and `defineFeedbackConversation` with the same conversation store and the same
scope projection. The `id` returned by `submit-feedback` is the canonical
thread identifier for reply and get. List returns the thread under the same
authorized scope.

## Planned package set

- `@emseepea/feedback@0.10.1`
- `@emseepea/create-api-backed-server@0.1.12`
- `@emseepea/create-database-schema-server@0.1.12`
- `@emseepea/create-html-ui-server@0.1.12`
- `@emseepea/create-mongodb-backed-server@0.1.12`
- `@emseepea/create-multi-instance-postgres-server@0.1.12`
- `@emseepea/create-openapi-backed-server@0.1.12`
- `@emseepea/create-progress-streaming-server@0.1.12`
- `@emseepea/create-react-ui-server@0.1.12`
- `@emseepea/create-resources-and-prompts-server@0.1.12`
- `@emseepea/create-soap-backed-server@0.1.12`
- `@emseepea/create-tool-server@0.1.12`

The staged `@emseepea/feedback@0.10.0` version is immutable and remains under
`next`; it was never promoted to `latest`. The checked recovery therefore uses
the next fresh feedback patch. The initializer patches give the corrected
`@emseepea/testing@0.23.1` dependency pins new immutable package versions.

## Verified before push

The feedback package builds successfully. The focused feedback, discovery,
annotation, durable-record, dogfood, black-box, and packed-install checks pass.
The recovery plan contains the feedback replacement and exactly eleven
initializer patch packages listed above.

The source contract and docs contain no MCP registration or annotation override
for `create-feedback-thread`. Tests verify that conversation discovery returns
only reply, list, and get, while submission still creates a durable thread that
can be retrieved and replied to through the returned identifier.

## Required release evidence

The final source commit must pass remote Quality. The release candidate must
then pass semantic qualification, publication under npm `next`, registry
integrity, signatures, provenance, and downloaded-package checks. Publish must
promote the exact candidate to `latest` and merge it back to `main`.

An independent clean installation of the published package must verify all of
the following:

- MCP discovery includes `submit-feedback` and the three conversation tools.
- MCP discovery excludes `create-feedback-thread`.
- The removed operation cannot be called through an alias or hidden route.
- A new submission can be retrieved and replied to using its returned `id`.
- A thread stored before this release remains listable, readable, and
  replyable without migration.

Only that published-package evidence can complete the release and the
confirmation criteria in ADR-0122.
