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

## Exact planned package set

Changesets calculates one minor npm release:

- `@emseepea/feedback@0.8.0`

No other package or website release is planned. Unchanged initializers retain
their existing generated-starter dependency pins. The example-quality check
now permits those exact older testing-package pins, as required by that policy.

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

The cancellation test requires a process reaper in this container. It passes
unchanged under a Linux child subreaper. This is local execution setup and adds
no changes to the testing package.

## Required publication evidence

Full local qualification must pass on the clean, exact commit before push.
GitHub Source Quality must then pass on that source commit, including the
vulnerability scan and standalone initializer checks.

The generated release pull request must bind its versioned head to that source
and pass the Release build. This stages the package under `next` and verifies
the downloaded package's integrity, signature, provenance, files, types, and
install behavior. Only that checked head may be merged into `publish`.

Publication must pass for the merge commit, including promotion to `latest`,
registry readback, release records, and merge-back to `main`. Local integration
tests do not replace these remote checks. The PostgreSQL tests do not claim
native ChatGPT journey coverage or guarantees for other feedback backends.

## Conditional release readiness

- Result: PASS
- Evidence gathered so far supports the planned release.
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full local qualification, exact-source
  Source Quality, the release-head Release build, and merge publication pass.
- Planned package: `@emseepea/feedback@0.8.0`.
