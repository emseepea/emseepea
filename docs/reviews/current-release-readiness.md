# Current Release Readiness

Date: 2026-09-12

Release verification is not complete. Eleven initializer patch releases still
require publication and verification.

## Release Batch

- `@emseepea/create-tool-server@0.0.26`
- `@emseepea/create-api-backed-server@0.0.24`
- `@emseepea/create-openapi-backed-server@0.0.6`
- `@emseepea/create-resources-and-prompts-server@0.0.23`
- `@emseepea/create-progress-streaming-server@0.0.24`
- `@emseepea/create-html-ui-server@0.0.25`
- `@emseepea/create-react-ui-server@0.0.24`
- `@emseepea/create-multi-instance-postgres-server@0.0.14`
- `@emseepea/create-database-schema-server@0.0.11`
- `@emseepea/create-mongodb-backed-server@0.0.11`
- `@emseepea/create-soap-backed-server@0.0.11`

## Change for Users

After this initializer patch release, every generated starter should install
the current Em See Pea packages. This includes `@emseepea/server@0.10.1`, which
keeps TypeScript inference bounded for large Zod output schemas while preserving
handler output checks.

## Verified Evidence

- The release workflow published `@emseepea/server@0.10.1`,
  `@emseepea/feedback@0.2.7`, `@emseepea/react@0.0.20`, and
  `@emseepea/testing@0.9.11` from commit
  `f2649b72f829afa2f3442c24c99e53e5e170cd37`.
- Registry version, integrity, provenance, and signature checks passed for
  those four packages. A clean registry installation and signature audit also
  passed.
- Post-publication verification then found that the latest generated
  `create-tool-server` project still installed `@emseepea/server@0.10.0`. The
  release workflow failed on the exact `0.10.0` versus `0.10.1` mismatch.
- All eleven initializer manifests already contain the current dependency
  versions. One patch changeset includes every affected published initializer
  so their generated projects receive those versions.
- Independent architecture review confirmed that all eleven initializers need
  patch releases and that no new architecture decision or job is required.

These results do not prove the new initializer versions. Exact-commit checks,
publication, downloaded-package installation, and container verification remain
required.

## Required Publication Evidence

- Quality must pass on the exact source and version commits.
- The release workflow must pass its maintained semantic examples before
  publication.
- Registry verification must confirm version, integrity, provenance,
  signatures, and clean installation for every initializer in this batch.
- The documented quickstart must create a project that installs
  `@emseepea/server@0.10.1` and passes its checks.
- Registry initializer checks must exercise the downloaded packages and their
  production containers.

## Review Status, Not Release Status

This section records review readiness. The release remains incomplete.

- Result: PASS
- Pipeline risk review: commit, push, and release must remain within the 5/25 appetite.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
