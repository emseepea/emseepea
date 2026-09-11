---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# Digest-Pinned Official Node Builder and Distroless Runtime

> Captured via `/wr-architect:capture-adr`. Tom Howard selected and ratified
> the Distroless runtime policy on 2026-09-11.

## Context and Problem Statement

Em See Pea's planned example containers need common build and runtime bases.
Recording literal image versions and digests as an architectural choice would
become stale whenever Node or an operating-system image receives a patch. Using
only mutable tags would silently change builds and weaken reproducibility.

The build stage needs npm and compilation tools. The production runtime needs
only Node, the application, and its runtime dependencies. Using a full Node
development image for both stages would preserve tools that the running service
does not need. The project needs a durable selection and refresh policy that
keeps mutable references in Dockerfiles and tests.

## Decision Drivers

- Container builds must be reproducible from immutable base references.
- The runtime Node version must match the repository's highest continuously
  qualified Node version.
- The production image should contain no shell or package manager when the
  application does not require them.
- Base images must run as non-root and support read-only execution.
- Common Linux deployment targets need explicit architecture coverage.
- Upstream signatures and identities must be verified.
- Normal security and patch updates must not require a new ADR.
- The policy must account honestly for two registries and update cadences.

## Considered Options

1. **Official Node builder with a Google Distroless runtime (chosen)** - Build
   with the official Node Debian image, then run the application in Google's
   signed non-root Node 24 Distroless image.
2. **Official Node Slim for both stages** - Keep one registry and an interactive
   shell in the runtime at the cost of a larger production surface.
3. **Mutable image tags** - Allow resolved image contents to change without a
   source update or review.
4. **A custom runtime image** - Own another image build, registry, and support
   boundary.

## Decision Outcome

Chosen option: **"Official Node builder with a Google Distroless runtime"**,
because build tooling belongs in the build stage while the production stage
needs only a minimal Node runtime whose exact contents, signature, user, and
architectures can be verified.

The build stage uses the official `docker.io/library/node` Debian `trixie-slim`
image. Its reference contains the exact current Node 24 patch recorded in
`.node-version` and used by the Node 24 continuous integration job, plus an
immutable Open Container Initiative (OCI) index digest.

The runtime stage uses the signed
`gcr.io/distroless/nodejs24-debian13:nonroot` image at an immutable OCI index
digest. It must provide the same exact Node patch as `.node-version`; an update
fails qualification rather than silently accepting a lagging runtime. Both
image indexes must contain at least `linux/amd64` and `linux/arm64/v8` manifests.

Literal patch versions and digests live in Dockerfiles and automated checks, not
in this decision. All Dockerfiles carry one identical builder reference and one
identical runtime reference.

Continuous integration:

- compares both runtime versions with `.node-version`;
- verifies both OCI index digests and required architectures;
- verifies the Distroless keyless Cosign signature uses Google's documented
  issuer and Distroless publishing identity;
- reads back the production image user and `node --version`;
- proves the runtime contains no shell or package manager;
- runs every initializer image as non-root with a read-only root filesystem;
- exercises the Node-based health check, mounted non-secret configuration,
  runtime secret injection, and direct signal-driven shutdown; and
- repeats all checks for each target architecture and any native dependency.

The Distroless Node image already supplies the `node` entrypoint. Each image
uses an exec-form command containing only the compiled server path, so Node is
process identifier 1 and receives termination signals directly. Dockerfile
runtime steps never depend on a shell. Health checks execute JavaScript through
Node rather than relying on shell utilities or `curl`.

The separately signed and digest-pinned Distroless `debug-nonroot` variant may
be documented for an explicit troubleshooting session. It is never the release
or default runtime image and cannot substitute for qualification of the minimal
image.

A policy-preserving Node 24 patch or digest refresh is a routine reviewed
version change and does not require a new ADR. Refresh is required when:

- `.node-version` changes;
- either upstream publishes a relevant Node or operating-system security update;
- either pinned digest is withdrawn or becomes unavailable;
- the Distroless runtime catches up to a required exact Node patch; or
- container qualification fails because a base is no longer usable.

No Dependabot, Renovate, or equivalent container updater is installed. Updates
therefore use reviewed manual pull requests and rebuild every standalone
initializer image. Updater automation is added only when repeated maintenance
shows that it earns its own configuration and operational surface.

Changing either trusted registry, either image family, the Debian distribution
line, the supported Node major, or required architecture policy triggers
reassessment and a superseding decision.

## Consequences

### Good

- Production images exclude a shell, package manager, and build tools.
- Both build and runtime inputs are immutable and inspectable.
- The runtime is non-root by construction and independently verified.
- AMD64 and ARM64 deployments are explicit.
- Normal patch and security updates remain routine maintenance.

### Neutral

- Mutable patch and digest values live in Dockerfiles and tests rather than the
  ADR.
- Build and runtime images come from different registries.
- Updates are manual until measured maintenance justifies automation.

### Bad

- Two upstreams create two trust boundaries and refresh cadences.
- Distroless may lag the exact Node patch required by `.node-version`.
- Live debugging is less convenient because the release image has no shell.
- Cosign verification adds qualification tooling.
- Future native dependencies require Debian 13 and per-architecture proof.

## Confirmation

- Every example Dockerfile uses identical digest-pinned official Node
  `trixie-slim` builder and Distroless Node 24 Debian 13 non-root runtime
  references.
- Both images report the exact Node 24 patch in `.node-version`.
- Both OCI indexes contain `linux/amd64` and `linux/arm64/v8` manifests.
- The Distroless signature matches Google's documented keyless issuer and
  publishing identity.
- The release image reports a non-root user and contains no shell or package
  manager.
- Every generated image passes health, readiness, runtime configuration, secret
  injection, and clean shutdown checks with a read-only root filesystem.
- Native runtime dependencies pass on both required architectures.
- A base refresh rebuilds and qualifies every standalone initializer image.
- Release evidence records both exact base references used by the qualified
  commit.
- No automatic-refresh claim is made unless updater configuration and its checks
  exist.

## Pros and Cons of the Options

### Official Node Builder with a Google Distroless Runtime

- Good, because build tools stay out of production and the runtime is signed,
  non-root, and minimal.
- Bad, because it adds a registry, signature tool, refresh cadence, and stricter
  debugging workflow.

### Official Node Slim for Both Stages

- Good, because one registry and image family simplify patch alignment and live
  debugging.
- Bad, because the production stage retains a shell, package manager, and other
  tools the server does not need.

### Mutable Image Tags

- Good, because rebuilds receive newer upstream content without source changes.
- Bad, because identical source can produce different unreviewed images.

### A Custom Runtime Image

- Good, because it could be tailored more aggressively.
- Bad, because the project would own another build, release, registry, and
  support boundary without a demonstrated need.

## Reassessment Criteria

Reassess when the supported Node major changes, Debian 13 leaves the appropriate
support window, target architectures change, Distroless cannot supply the exact
qualified Node patch or a required native dependency, either registry no longer
meets the trust policy, or repeated manual refresh work justifies an updater.

## Related Decisions

- [npm Scripts as the User-Facing Command Contract](0076-npm-scripts-as-the-user-facing-command-contract.proposed.md)
- The safe-container decision will depend on this base-image policy before
  implementation.
