# Current Release Readiness

Date: 2026-10-23

## Operation-specific feedback descriptions

Status: **FOCUSED CHECKS PASS; EXACT-COMMIT QUALIFICATION PENDING**.

[Issue #179](https://github.com/emseepea/emseepea/issues/179) needs accurate
application-specific feedback wording through the native submission helper.
The default now concerns the application operation being performed and excludes
unrelated conversation and general behavior. An optional complete description
supports accurate application, storage and retention wording.

The [approved delivery outcome](feedback-description-outcome-2026-10-23.md)
targets end of Sunday, 25 October 2026, Australia/Sydney. Completion requires
publication and an independent installed-package check, not just source changes.

All 64 feedback tests passed. The new public and protected journeys compare
all discovery fields except the description across the six supported protocol
versions. They verify bounded input, delayed durable receipt, backend failure
and blank-description rejection. Public type checks and lint passed. These
checks use synthetic data; they do not establish marketplace acceptance,
automatic invocation behavior or privacy of arbitrary stored text.

Architecture review: the proposed description option preserves the native
handler, schemas, authorization, annotations and hook dispatch. The new
[description decision](../decisions/0127-application-specific-feedback-submission-descriptions.proposed.md)
stays proposed and does not claim production confirmation or ratification.

Privacy review: the default excludes identity, financial details, conversation
and raw application data. No collection mechanism changes. A replacement
can omit guidance; the public API and both guides explicitly assign accurate
triggers, disclosure, objections and storage policy to the adopter. No server-
enforced privacy guarantee is claimed.

Scoped cumulative risk assessment: commit, push and release are each estimated
at 5/25 (Severe impact 5 × Rare likelihood 1), conditional on all existing
qualification gates. The metadata-only implementation, protocol comparisons,
receipt and failure checks control regression risk. Required semantic checks
control model-behavior risk. Registry, provenance and installed-package checks
control publication risk. No credentials, new dependencies or backend writes
are introduced by this change. Missing or failed gates block publication.

### Qualification repairs

The first full run stopped because PostgreSQL could not read checkout SQL
fixtures with owner-only permissions. After correcting those local permissions,
both PostgreSQL suites passed all 12 focused tests. The second full run passed
all workspace checks but failed three root checks.

A direct root run recorded 446 passes and three failures: fresh installs
resolved two patches outside the scanned lockfile; a packed initializer's SQL
fixture inherited the local restrictive file-creation mask; and one paragraph
in each feedback guide exceeded the prose-density limit. The guides now split
that paragraph. Qualification uses the standard 022 file-creation mask so
synthetic SQL fixtures remain readable inside containers.

The lockfile now records `@fastify/deepmerge@3.2.4` and
`fast-json-stringify@7.1.3`, the patches selected by fresh installations under
existing dependency ranges. No dependency manifest or publication scope changes.
The normal vulnerability scan and complete qualification must cover this updated
tree before release. These repairs are not passing full-run evidence.

### Planned publication

Changesets calculates the public npm target below. The private website moves
to 0.0.13 so the updated feedback guide deploys with the release. No other public
package is planned for publication.

- `@emseepea/feedback@0.11.0`

Clean committed-head `push:qualify`, benchmark, exact-source Quality, semantic
Release, registry verification, Publish and fresh installation remain pending.
The preceding release's packages were promoted and tagged; its final merge-back
qualification was cancelled. That does not qualify this change, which requires
its own successful source Quality run.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
