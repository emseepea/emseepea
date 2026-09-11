# Current Release Readiness

Date: 2026-09-11

## Release Batch

- `@emseepea/server@0.9.1`
- `@emseepea/feedback@0.2.5`
- `@emseepea/react@0.0.18`
- `@emseepea/testing@0.9.8`
- `@emseepea/create-api-backed-server@0.0.22`
- `@emseepea/create-database-schema-server@0.0.9`
- `@emseepea/create-html-ui-server@0.0.23`
- `@emseepea/create-mongodb-backed-server@0.0.9`
- `@emseepea/create-multi-instance-postgres-server@0.0.12`
- `@emseepea/create-openapi-backed-server@0.0.4`
- `@emseepea/create-progress-streaming-server@0.0.22`
- `@emseepea/create-react-ui-server@0.0.22`
- `@emseepea/create-resources-and-prompts-server@0.0.21`
- `@emseepea/create-soap-backed-server@0.0.9`
- `@emseepea/create-tool-server@0.0.24`

The initializer patches regenerate their published tarballs under new package
versions so generated projects pin the package versions in this batch.

## Change for Users

Every standalone initializer now creates a project with the same container
build contract:

```sh
npm run container:build
```

The script owns the Docker build command so public routine instructions do not
make users memorize Docker flags. `npm install` remains the bootstrap step that
creates the lockfile used by the container build.

Each generated project includes its own Dockerfile and `.dockerignore`. The
images use a digest-pinned official Node 24.21.0 Trixie Slim builder and a
digest-pinned Google Distroless Node 24 Debian 13 non-root runtime.

Production containers fail closed. The image selects
`production-behind-proxy`, binds publicly only in that mode, and requires an
absolute runtime-mounted deployment JSON file. That file contains non-secret
proxy, origin, authority, and rate-limit policy. Secrets stay in the deployment
platform at runtime, not in source, build arguments, Dockerfiles, image layers,
or deployment policy files.

The database examples keep Docker Compose as a local development dependency
harness. Users start and reset those local databases through `npm run db:start`
and `npm run db:reset`. The reset command is documented as deleting the local
database volume.

`website/src/content/docs/examples.md` is the single maintained container guide.
Getting Started links to that section, the root README has one pointer, and the
example READMEs keep only short script-first instructions plus a descriptive
link to the guide.

## Local Evidence Before Publication

- Tom Howard ratified ADR-0076, ADR-0077, and ADR-0078. Their
  human-oversight markers are confirmed and the decision compendium is current.
- Focused raw HTTP, official-client, type, authentication, authorization,
  isolation, cancellation, limit, late-call, and installed-package checks pass.
- TypeScript compilation, lint, package tests, non-container framework tests,
  documentation checks, and website build pass.
- `tests/black-box/proxy-progress.test.mjs` and
  `tests/load/proxy-progress.test.mjs` cover protected progress after access
  checks and behind the trusted-proxy boundary.
- Independent architecture, Jobs To Be Done, Markdown accessibility, cognitive
  accessibility, and release-risk reviews are required on the final content.
- The generated request and response validation path measured 1.08 ms median
  CPU and 387 KiB median peak transient heap per call, within the 5 ms and
  1 MiB integration-example budgets. Exact-commit CI repeats this check.
- Local PostgreSQL and MongoDB integration qualification passed with fresh
  containers. Both UI browser accessibility suites and the SOAP integration
  suite also passed.
- `npm run build`, `npm run lint`, `npm run typecheck`, and
  `npm run decisions:check` pass locally.
- `node --test tests/docs/example-quality.test.mjs` passes. It verifies every
  initializer owns the same safe container contract, the pinned base image
  references, the npm script contract, the `.dockerignore` boundary, and the
  no-raw-Docker routine documentation rule.
- `node --test tests/black-box/deployment-environment.test.mjs` passes. It
  covers loopback defaults, fail-closed production configuration, file size and
  parsing limits, and public binding only when production mode is explicit.
- The black-box, documentation, and LLM test slice passes with packed
  initializer execution intentionally skipped by
  `EMSEEPEA_SKIP_PACKED_INITIALIZERS=true`.
- `npm run benchmark:built` passes locally, including the named production JSON
  boundary for accepted, rate-limited, capacity-exhausted, and malformed
  requests.
- `GITHUB_ACTIONS=true npm run test:load:streaming` passes locally and preserves
  the protected-progress load boundary.
- `node --test tests/docs/registry-initializer-workers.test.mjs` passes. It
  verifies that post-publication registry initializer checks can reuse the same
  container qualification harness with downloaded registry tarballs.
- Workflow YAML parsing passes for `.github/workflows/quality.yml` and
  `.github/workflows/release.yml`.
- Cognitive-accessibility evidence is bound to the changed public Markdown in
  `docs/reviews/cognitive-accessibility-2026-09-11.md`.
- Implementation commit
  `dc77c1cd51832fed9439d09bf554f587e04b1a1b` passed all 15 required jobs in
  [Quality run 34592518259](https://github.com/emseepea/emseepea/actions/runs/34592518259),
  including Node.js 22.23.2, Node.js 24.21.0, OSV, website publication checks,
  and all 11 initializer/container shards. The separate website publication
  job was skipped, so this is pre-publication evidence only.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, Open Source
  Vulnerabilities (OSV), website, package, standalone initializer, database,
  accessibility, performance, base-image, and container checks.
- The standalone initializer job must create all eleven projects outside the
  monorepo, install exact current packed first-party artifacts, build the
  containers, verify the safe runtime boundary, and pass lint, ordinary tests,
  and semantic smoke tests.
- The Quality workflow must verify both base-image indexes include `linux/amd64`
  and `linux/arm64/v8`, and must verify the Distroless Cosign identity.
- The release job that runs after Quality must pass every provider-native
  semantic example before publication. Semantic evaluation runs after the
  cheaper quality checks.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, clean installation, software bills of materials, package contents,
  signatures, and exact registry tarballs.
- Post-publication verification must initialize every starter from npm, verify
  the downloaded packages, preserve the generated public-registry lockfile while
  the image runs `npm ci`, and reuse the complete container qualification
  harness against those installed registry versions.
- GitHub Pages publication must complete before website deployment is claimed.
- The registry-installed server smoke test must still cover one request-scoped
  log as regression evidence for the already-versioned logging path, then return
  the checked final result.

## Review Status

- Result: PASS for pre-publication readiness at implementation commit
  `dc77c1cd51832fed9439d09bf554f587e04b1a1b` via
  [Quality run 34592518259](https://github.com/emseepea/emseepea/actions/runs/34592518259).
- Release verification: NOT COMPLETE until the exact registry, provenance,
  standalone, container, website, and remaining publication gates pass.
- Final result: within appetite, subject to the required exact-commit gates.
