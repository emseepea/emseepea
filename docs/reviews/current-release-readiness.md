# Current Release Readiness

Date: 2026-10-25

## Initializer container security update

Status: **LOCAL FEEDBACK CHECKS PASS; RELEASE PENDING**.

The queued release updates all eleven initializer containers to Node.js
24.22.1 and refreshed, digest-pinned builder and runtime images. Changesets
computes the package versions below. No version is edited by hand.

The previous release build rejected valid feedback wording: one trial said
"below the search results", but the test required "below the results". The
test now retains the required detail words and uses its existing independent
judgments to check both the submitted detail and final response. Exact calls,
the friction category and the objection checks are unchanged.

Fresh local checks passed eight feedback cases, with three conversations and
nine judgments per case. These used the existing local Claude account and
`claude-sonnet-4-6`; they do not replace credentialed release qualification.
The focused builds and repository lint check also passed. The current source
still requires full clean-commit qualification, exact-source Quality, release
checks, registry verification, promotion and merge-back verification.

The local production benchmark was inconclusive. One accepted-request sample
measured 58 requests per second against the existing 100-request threshold.
CPU, allocation and wire-size checks passed in all three populations; the
other two populations passed throughput too. This is not a benchmark pass.

The repair changes tests, diagnostic output and readiness metadata, not
framework source or release controls. The root lockfile now records
`fast-json-stringify@7.2.0`, which a fresh consumer install already selected
within the existing dependency constraints. That graph still requires a fresh
vulnerability scan and exact-source qualification. No public dependency
constraint changes. This release does not complete #174.
Architecture review passed. The scoped cumulative risk assessment is within
the 5/25 appetite, subject to the required exact-commit gates. Cognitive review
must cover this exact metadata before commit or publication.

### Planned public packages

- `@emseepea/create-api-backed-server@0.1.25`
- `@emseepea/create-database-schema-server@0.1.25`
- `@emseepea/create-html-ui-server@0.1.25`
- `@emseepea/create-mongodb-backed-server@0.1.25`
- `@emseepea/create-multi-instance-postgres-server@0.1.25`
- `@emseepea/create-openapi-backed-server@0.1.25`
- `@emseepea/create-progress-streaming-server@0.1.25`
- `@emseepea/create-react-ui-server@0.1.25`
- `@emseepea/create-resources-and-prompts-server@0.1.25`
- `@emseepea/create-soap-backed-server@0.1.25`
- `@emseepea/create-tool-server@0.1.25`

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.

## Previous release readiness, retained history

Review date: 2026-10-23.

### Operation-specific feedback descriptions

Status: **RELEASED AND VERIFIED**.

`@emseepea/feedback@0.11.0` is published on npm's `latest` tag. Its default description
limits feedback to the application operation being performed. The optional
`description` setting supports accurate application-specific wording while
preserving native execution and receipts. Website 0.0.13 publishes the guide.

The [approved outcome](feedback-description-outcome-2026-10-23.md) is complete
before the Sunday, 25 October 2026 target in Australia/Sydney. The
[release evidence](feedback-description-release-2026-10-23.md) binds the exact
source, candidate, promotion and merge-back revisions to successful workflows.
It also records the fresh installed-package and published-guide checks.

All required source, semantic, vulnerability, registry, provenance, downloaded-
package and merge-back checks passed. The local production benchmark passed all
three populations with `qualifies: true`. The feedback semantic suite passed
eight cases with three fresh answer trials and nine judge verdicts per case.

The installed-package verification passed all six supported protocol versions,
configuration typing, validation, receipt timing and failure behavior. It used
a synthetic in-memory backend. These checks do not establish native ChatGPT
production behavior, marketplace acceptance or private stored text.

Architecture and privacy boundaries remain those of the
[proposed description decision](../decisions/0127-application-specific-feedback-submission-descriptions.proposed.md).
The decision does not claim architectural ratification or actual production
confirmation. Adopters remain responsible for accurate replacement guidance,
collection policy, storage and retention.

The scoped cumulative commit, push and release risk assessment remains 5/25,
within the repository's appetite. The existing qualification and publication
gates all completed successfully. No approval or security control was changed.

#### Published public package

- Previously published: `@emseepea/feedback@0.11.0`

- Result: PASS
- Final result: within appetite.
