# Current Release Readiness

Date: 2026-09-30

This review covers the package-guide correction for published result schemas
and the packages planned for the next release. An abandoned release attempt
published some earlier versions from different commits. Those versions cannot
form one verified release. The fresh versions below are planned, not yet
published. The website is outside this release and remains unchanged.

## Planned Package Set

- `@emseepea/testing@0.17.0`
- `@emseepea/create-api-backed-server@0.1.0`
- `@emseepea/create-database-schema-server@0.1.0`
- `@emseepea/create-html-ui-server@0.1.0`
- `@emseepea/create-mongodb-backed-server@0.1.0`
- `@emseepea/create-multi-instance-postgres-server@0.1.0`
- `@emseepea/create-openapi-backed-server@0.1.0`
- `@emseepea/create-progress-streaming-server@0.1.0`
- `@emseepea/create-react-ui-server@0.1.0`
- `@emseepea/create-resources-and-prompts-server@0.1.0`
- `@emseepea/create-soap-backed-server@0.1.0`
- `@emseepea/create-tool-server@0.1.0`
- `@emseepea/server@0.19.0`
- `@emseepea/feedback@0.4.0`
- `@emseepea/react@0.4.0`
- `@emseepea/svelte@0.2.0`

This handwritten list is the documented release-unblocking workaround while
problem `P008` remains open. It is not independent human confirmation of the
generated release plan.

## Source Evidence and Limits

A packed-package behavioural test checks that the guide included in the packed
`@emseepea/server` package explains open and closed result-schema contracts and
the known limit for piped strict objects.

Exact local qualification passed on source commit
`d12bb3d08efd4aec791602c36a8ba001928cfa89`. This does not qualify the
release-recovery commit. The exact commit pushed to `main` must pass its own
qualification and Quality check. The release pull request's latest commit must
pass its Release checks. Independent architecture, Jobs To Be Done,
cognitive-accessibility, and voice-and-tone reviews passed for the
package-guide correction and its public copy. This readiness record needs its
own cognitive-accessibility review before push.

## Required Publication Evidence

- Quality must pass on the exact release-recovery commit pushed to `main`.
- The generated release pull request must contain only the 16 packages listed
  above. Its Release checks must pass on the latest commit in that pull request.
- Trusted publication must publish all 16 planned versions under `next`.
- Registry readback must confirm each published version, package integrity,
  signatures, build origin, exact source commit, and public types. Clean
  installations must exercise the registry packages.
- Only the verified tarballs may then be promoted to `latest`, tagged,
  released, and merged back.

## Review Status, Not Release Status

The `Result` and `Final result` labels below are required by the release
verifier. They approve this conditional readiness review, not publication or
promotion. Release verification is still incomplete.

- Result: PASS
- Risk review: PASS within the accepted risk threshold, provided all required
  checks pass on the exact source commit.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE. The prior release candidate failed
  exact-source provenance verification; its published versions are not used
  for this release.
