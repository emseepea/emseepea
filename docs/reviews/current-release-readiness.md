# Current Release Readiness

Date: 2026-10-08

## Cross-instance PostgreSQL feedback updates

The planned release adds `createPostgresFeedbackUpdateConsumer` to
`@emseepea/feedback/postgres`. Each serving instance can consume committed,
scoped feedback updates with its own durable acknowledgements and wake its
local MCP resource subscribers.

The consumer selects unacknowledged events without a timestamp or sequence
cursor. A transaction that commits late remains eligible, even after a newer
event has been consumed. Acknowledgement follows a successful callback;
callback or connection failures can be retried with the same identity.

Delivery is at least once while outbox events are retained. Applications own
polling, current authorization and retention checks, notification callbacks,
timeouts, and outbox retention. Consumption is independent of email dispatch.
Only PostgreSQL is supported by this new API.

## Embedded Model Context Protocol resource qualification

The planned `@emseepea/testing` patch extends `emseepea-qualify` so a
`tools/call` checkpoint can verify embedded MCP resources returned by a tool.
Adopter scenarios can assert each resource's:

- URI identity;
- MIME type;
- decoded byte count; and
- SHA-256 digest.

The command handles text and base64 resource content, rejects malformed base64,
and enforces configured byte and collection limits. Evidence retains hashes,
MIME types, byte counts, and categorical outcomes rather than original resource
content or clear resource URIs.

Embedded-resource checks inspect only the content returned by the tool. They do
not dereference the resource URI or grant access. Resource links and authorised
`resources/read` checks remain separate checkpoints.

The report continues to record `evidenceKind: "mcp-cli"` and
`nativeChatgpt: "not-tested"`. This release does not claim that ChatGPT opens a
file, renders an image, displays a Sources entry, or materialises an attachment.

Architecture, Jobs To Be Done, cognitive-accessibility, and pipeline-risk
reviews passed for the source change and its public guidance.

## Exact planned package set

Changesets and the checked staged-candidate recovery calculate two npm
releases:

- `@emseepea/feedback@0.8.1`
- `@emseepea/testing@0.21.5`

The earlier staged candidate published `@emseepea/feedback@0.8.0` and
`@emseepea/testing@0.21.4` under `next`, then failed downloaded-package
verification before promotion. The recovery receipt binds those occupied
versions to the exact failed candidate and chooses the next patch versions.

No initializer package or website release is planned. Maintained initializer
manifests remain aligned with the currently published `0.1.7` initializer
packages and continue to use `@emseepea/testing@0.20.5` for development. Their
starter dependencies and generated runtime contents do not change.

## Validation and review

Local build, public type contracts, lint, benchmarks, and the PostgreSQL
integration suite passed. Regression evidence covers late commits, callback
and acknowledgement retries, reconnects, multiple batches, scope isolation,
and a worker reply waking live subscriptions on two serving instances.

Source documentation was reviewed against cognitive-accessibility criteria.
The package guide separates startup, delivery, recovery, policy, and cleanup
instructions, and states the PostgreSQL-only support boundary.

The principal risks are duplicate hints, lost hints after premature outbox
cleanup, and notifying a resource after permissions change. Durable scoped
receipts, duplicate-tolerant callbacks, explicit retention requirements, and
application policy checks control these risks. Resource reads remain the
source of truth. Residual risk is within the project's Low appetite, subject
to exact-commit qualification and the required publication gates.

The feedback cancellation test requires a process reaper in this container. It
passes unchanged under a Linux child subreaper. This is local execution setup
and adds no changes to the testing package.

The embedded-resource suite covers text and binary content, resource-link
coexistence, URI and MIME mismatches, byte and digest mismatches, malformed
base64, collection limits, byte limits, and redacted evidence. The checks never
dereference returned URIs and preserve the separate authorised `resources/read`
boundary.

## Required publication evidence

Full local qualification must pass on the clean, exact commit before push.
GitHub Source Quality must then pass on that source commit, including the
vulnerability scan and standalone initializer checks.

The generated release pull request must bind its versioned head to that source
and pass the Release build. This stages the packages under `next` and verifies
the downloaded packages' integrity, signatures, provenance, files, types, and
install behaviour. Only that checked head may be merged into `publish`.

Publication must pass for the merge commit, including promotion to `latest`,
registry readback, release records, and merge-back to `main`. Local integration
tests do not replace these remote checks.

Verify `@emseepea/testing@0.21.5` from the downloaded registry package. The
verification must cover:

- signature and provenance;
- public files and type exports;
- the `emseepea-qualify` executable;
- embedded text and binary resource qualification;
- install and import behaviour; and
- the `latest` tag.

Native ChatGPT rendering and adopter production outcomes remain separate
evidence. The PostgreSQL tests do not claim guarantees for other feedback
backends.

## Conditional release readiness

- Result: PASS
- Evidence gathered so far supports the planned release.
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full local qualification, exact-source
  Quality, the release pull request Release build, exact merge publication,
  downloaded-package verification, and `latest` verification pass.
- Planned packages: `@emseepea/feedback@0.8.1` and
  `@emseepea/testing@0.21.5`.

## Retained semantic failure and scenario correction

Release run [37768276333](https://github.com/emseepea/emseepea/actions/runs/37768276333)
failed before publication on candidate
`d1ec27a2b334aaa5758eb37c030f837d98c1b26d`. The retained artifact archive has
SHA-256 `4765deaddf3b595ffafa61ec0d66962a041c7cf02299fea4a468c8c4df04aa19`.

All three conversations honored the user's feedback objection. One answered
“Find that same snap pea variety again” from the previous result, without
calling the catalogue search. That wording allowed a cached answer but the
test required a fresh search. The scenario now asks for another catalogue
search and current matches. The exact search-only assertion remains, so any
feedback call still fails. No failed semantic trial is being retried on the
old candidate. The corrected source needs new qualification, Source Quality,
and an authoritative Release evaluation before publication.
