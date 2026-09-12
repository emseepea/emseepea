# Current Release Readiness

Date: 2026-09-12

Release verification is not complete. Fifteen patch releases still require
publication and verification.

## Release Batch

- `@emseepea/server@0.10.2`
- `@emseepea/create-tool-server@0.0.27`
- `@emseepea/create-api-backed-server@0.0.25`
- `@emseepea/create-openapi-backed-server@0.0.7`
- `@emseepea/create-resources-and-prompts-server@0.0.24`
- `@emseepea/create-progress-streaming-server@0.0.25`
- `@emseepea/create-html-ui-server@0.0.26`
- `@emseepea/create-react-ui-server@0.0.25`
- `@emseepea/create-multi-instance-postgres-server@0.0.15`
- `@emseepea/create-database-schema-server@0.0.12`
- `@emseepea/create-mongodb-backed-server@0.0.12`
- `@emseepea/create-soap-backed-server@0.0.12`
- `@emseepea/feedback@0.2.8`
- `@emseepea/react@0.0.21`
- `@emseepea/testing@0.9.12`

## Change for Users

`@emseepea/server@0.10.2` documents and preserves the intentional rejection of
deprecated MCP Sampling. Applications needing model generation use their
chosen model-provider API instead.

After the initializer patch releases, every generated starter should install
`@emseepea/server@0.10.2`.

The release planner also carries `@emseepea/feedback`, `@emseepea/react`, and
`@emseepea/testing` as dependent patch releases so exact first-party package
references remain aligned. They add no separate feature in this increment.

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
- The ratified Sampling decision, focused black-box and type checks, exact
  packed-package check, and independent architecture and cognitive-accessibility
  reviews passed for the server patch.

These results do not prove any release in this batch. Exact-commit checks,
publication, registry readback, downloaded-package installation, and container
verification remain required where applicable.

## Required Publication Evidence

- Quality must pass on the exact source and version commits.
- The release workflow must pass its maintained semantic examples before
  publication.
- Registry verification must confirm version, integrity, provenance,
  signatures, and clean installation for every package in this batch.
- The documented quickstart must create a project that installs
  `@emseepea/server@0.10.2` and passes its checks.
- Registry initializer checks must exercise the downloaded packages and their
  production containers.
- Registry verification for `@emseepea/server@0.10.2` must confirm that the
  package exposes no Sampling helper, rejects hand-built Sampling requests, and
  includes the model-provider guidance.

## Review Status, Not Release Status

This section records review readiness. The release remains incomplete.

- Result: PASS
- Pipeline risk review: commit, push, and release must remain within the 5/25 appetite.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
