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

# Example-Owned Production Containers Behind Trusted Proxies

> Captured via `/wr-architect:capture-adr`. Tom Howard ratified this
> example-container policy on 2026-09-11.

## Context and Problem Statement

The eleven maintained Em See Pea examples are also the source templates for
published standalone initializers. None currently demonstrates how to build and
run the generated server as a production container. The three database examples
use Docker Compose only to start local development dependencies with demo
credentials.

A Dockerfile alone would be misleading. Em See Pea defaults to a loopback
deployment profile, and that profile correctly refuses a public bind. A safe
container example must preserve the local default while demonstrating the
existing production-behind-proxy security boundary, deterministic image builds,
least-privilege execution, dependency readiness, clean shutdown, and exact
standalone qualification.

The user-facing command contract is already established by
[npm Scripts as the User-Facing Command Contract](0076-npm-scripts-as-the-user-facing-command-contract.proposed.md).
The build/runtime image family and update policy are already established by
[Digest-Pinned Official Node Builder and Distroless Runtime](0077-digest-pinned-official-node-builder-and-distroless-runtime.proposed.md).

## Decision Drivers

- Every published initializer must produce a self-contained project.
- Local `npm start` must remain loopback-only and safe by default.
- Production containers must fail closed when proxy policy is incomplete.
- Images must contain no build-time secrets and run with least privilege.
- A lockfile must make image builds reproducible.
- Schema, SOAP, database, and UI runtime assets must survive the build boundary.
- Evidence must exercise every generated project, not only monorepo sources.
- Existing initializer generation and continuous integration should be reused.
- Local database Compose files must not appear to be production recipes.
- Public guides must have one maintained source and stable npm commands.

## Considered Options

1. **Example-owned production containers behind trusted proxies (chosen)** -
   Every initializer source owns its container files and documents a fail-closed
   production journey through the existing trusted-proxy boundary.
2. **Build-only local containers** - Build and run an unexposed loopback image
   without demonstrating production deployment.
3. **One representative or shared container template** - Containerise one
   example or maintain a second shared template outside each standalone source.
4. **Leave containerisation undocumented** - Require every adopter to design the
   complete container boundary independently.

## Decision Outcome

Chosen option: **"Example-owned production containers behind trusted proxies"**,
because the copyable examples should teach the complete safe deployment path,
not merely produce an image that cannot be deployed or is unsafe when exposed.

### Owned files and scope

Each of these eleven initializer example directories owns a `Dockerfile`, a
`.dockerignore`, and generated-project README instructions:

- `tool-server`
- `api-backed-server`
- `openapi-backed-server`
- `resources-and-prompts-server`
- `progress-streaming-server`
- `html-ui-server`
- `react-ui-server`
- `multi-instance-postgres-server`
- `database-schema-server`
- `mongodb-backed-server`
- `soap-backed-server`

`ui-shared` is excluded because it is not a standalone initializer. The existing
initializer build loop copies the files into `initializer-dist`. No second
container-template tree or generator framework is introduced.

### Image construction and command

The builder, runtime, immutable reference, signature, architecture, non-root,
and refresh rules come from ADR-0077. The Dockerfiles do not define a competing
image policy.

Generated-project instructions require `npm install` before
`npm run container:build`. Installation creates `package-lock.json`. The
Dockerfile fails when the lock is absent and uses `npm ci`; it never resolves
dependencies with `npm install` during the image build. Public routine guidance
does not expose the underlying Docker command.

Before publication, continuous integration installs exact packed first-party
artifacts from the current commit. It makes those tarballs reachable inside the
build context, or uses an isolated local registry, so every lock resolution is
available to `npm ci` during the image build. Qualification rejects fallback to
previously published first-party versions. After publication, normal users run
ordinary `npm install`, producing registry-valid lock entries.

The runtime contains the production dependency closure, compiled `dist` output,
and explicitly required assets. Those assets include the SOAP example's
`contracts/` and the HTML and React runtime output, including the React browser
bundle. Source, tests, evidence, generators, build tools, lockfile, shell, and
package manager do not remain in the runtime unless the running application
demonstrably needs a specific file.

Every image uses an exec-form command so Node receives termination signals as
process identifier 1. The multi-instance PostgreSQL image runs one
`dist/server.js` process on one stable port. Production scale uses separate
containers behind the proxy sharing PostgreSQL. `dist/start-two.js` remains a
local demonstration only.

### Production configuration

Ordinary `npm start` leaves `EMSEEPEA_DEPLOYMENT_MODE` unset and uses the
loopback profile on `127.0.0.1`. A container image sets only the non-secret
selector `EMSEEPEA_DEPLOYMENT_MODE=production-behind-proxy`.

That mode requires `EMSEEPEA_DEPLOYMENT_CONFIG_FILE` to name an absolute path
to a runtime-mounted UTF-8 JSON file no larger than 16 KiB. The file has exactly
these fields:

```json
{
  "allowedAuthorities": ["mcp.example.com"],
  "allowedOrigins": ["https://mcp.example.com"],
  "trustedProxyAddresses": ["10.0.0.10"],
  "rateLimit": {
    "maxRequests": 100,
    "windowMs": 60000,
    "maxClients": 1000
  }
}
```

Those values illustrate the shape and are never defaults. The parser rejects
unknown or missing keys, oversized files, invalid UTF-8 or JSON, empty arrays,
duplicate or empty array entries, unsafe integers, invalid authorities or HTTPS
origins, and trusted proxies that are not exact normalized IP addresses. CIDR
ranges are not accepted. An unknown mode, relative or unreadable file, or invalid
content exits before application creation or listening. Valid production mode
binds the container process to `0.0.0.0`.

The proxy terminates TLS and forwards exactly one validated client hop plus
HTTPS and authority metadata. It forwards `Origin` only when supplied and
forwards `Authorization` unchanged. The application owns allowlists, trusted
proxy validation, rate limiting, authentication, and authorization. Protected
capabilities authenticate before handler or progress work. The application
container is not safe for direct public exposure.

No secret value appears in a Dockerfile default, build argument, copied file,
layer, or image history. Operators inject secrets at runtime through their
platform secret provider as environment variables or supported mounted files.
This permits existing `DATABASE_URL` and `MONGODB_URL` inputs without making
them image configuration. Secret values are not shown literally in production
instructions, placed in the non-secret deployment file, or logged.

Every `.dockerignore` excludes `.env*`, `.npmrc`, version-control metadata,
`node_modules`, `dist`, `initializer-dist`, artifacts, test evidence, and logs.

### Compose boundary

Existing database Compose files remain dependency-only local development
harnesses. Published database ports stay loopback-bound, literal credentials are
labelled demo-only, and Compose is never presented as the production proxy or
application-container recipe. Non-database examples do not gain Compose files.
The `db:start`, `db:reset`, and composed `dev` commands follow ADR-0076.

### Qualification and performance

The existing Node 24 standalone-initializer job qualifies containers; no new
workflow is introduced. For every generated project outside the monorepo it:

- completes the exact-current installation described above;
- verifies the container files, npm build contract, and instructions;
- builds and inspects both target architectures, image user, Node version,
  signatures, and required runtime assets under ADR-0077;
- runs non-root with a read-only root filesystem, bounded temporary filesystem,
  all Linux capabilities dropped, and `no-new-privileges`;
- reaches `/healthz` and `/readyz` through a real trusted proxy;
- completes the example's minimum deterministic MCP journey;
- supplies real local fixture or database services for dependency-backed
  examples; and
- verifies clean signal-driven shutdown without detached work.

The ordinary non-streaming JSON production boundary uses a named, fixed
benchmark profile covering accepted, rate-limited, capacity-exhausted, and
malformed requests. Each case must sustain at least 100 requests per second and
stay within 5 ms p95 framework CPU per request, 256 KiB p95 transient allocation
per request, and 2 KiB average framework-added wire bytes per request.

Until observed traffic exists, the projection records
`no data - worst-case assumption` and assumes 8,640,000 incoming requests per
day. It reports class-specific daily CPU, allocation, and wire deltas plus an
explicit `PASS` or `FLAG`. This is a planning assumption, not a traffic bound.

Protected progress makes no throughput or latency claim. It retains ADR-0068's
authentication-before-stream, non-buffering proxy, RSS, retained-heap, limit,
cancellation, and shutdown qualification.

### Public documentation

`website/src/content/docs/examples.md` is the single maintained container guide.
It states that every initializer includes the npm build contract, production
requires a trusted proxy and runtime configuration, secrets remain runtime-only,
and database Compose is local-only. It links to maintained example READMEs and
framework proxy guidance without duplicating runnable Docker snippets.

Getting Started links to that container section and the root README contains one
discoverability sentence. Documentation checks require the website section,
README references, identical manifest script, and absence of routine raw Docker
build or run commands. Existing website build, link, and cognitive-accessibility
gates apply to every changed public page.

## Consequences

### Good

- Every initializer teaches one complete safe container path.
- Images fail closed instead of weakening the loopback boundary.
- Runtime images are reproducible, minimal, non-root, and free of build secrets.
- Qualification covers every standalone image and dependency boundary.
- npm scripts and website guidance provide stable, discoverable instructions.

### Neutral

- Container use adds `npm install` before the npm build command.
- Production operators supply a proxy and explicit deployment policy.
- The same small container pattern appears in every standalone source.

### Bad

- Eleven examples must keep their files and instructions aligned.
- Image, proxy, and multi-architecture journeys increase CI time.
- Production configuration is more involved than an unsafe direct bind.

## Confirmation

- The canonical initializer list requires all eleven examples, and no
  non-initializer workspace, to own the container files.
- Every initializer passes its documented install, npm image build, hardened
  execution, proxy, health, readiness, MCP, and shutdown journey.
- Prepublication qualification uses exact packed first-party artifacts and fails
  on registry fallback.
- Image inspection satisfies every ADR-0077 base, signature, architecture,
  runtime, and asset check.
- Image history and context contain no secrets, credential files, local
  environment files, source-control metadata, or evidence artifacts.
- Missing or invalid production policy exits before listening; local startup
  remains loopback-only.
- Every journey rejects invalid forwarding, authority, origin, proxy address,
  rate-limit, authentication, and authorization inputs before application work.
- Database Compose ports remain loopback-bound and its credentials and purpose
  are explicitly local and non-production.
- Ordinary JSON performance reports the exact profile, four request classes,
  measurements, daily projection source, and result against ADR-0014.
- Protected progress reports only ADR-0068's load and safety evidence.
- Website, README, npm-script, link, build, and cognitive-accessibility checks
  pass without duplicated routine Docker commands.

## Pros and Cons of the Options

### Example-Owned Production Containers Behind Trusted Proxies

- Good, because every copied project carries a complete qualified deployment
  example.
- Bad, because the surface must remain aligned across eleven sources.

### Build-Only Local Containers

- Good, because it adds a smaller image build.
- Bad, because it does not teach safe deployment and invites workarounds around
  the loopback guard.

### One Representative or Shared Container Template

- Good, because fewer files are maintained.
- Bad, because copied examples cease to be self-contained and drift
  from their published initializers.

### Leave Containerisation Undocumented

- Good, because it adds no maintenance.
- Bad, because each adopter must rediscover the security, lifecycle, and asset
  boundary independently.

## Reassessment Criteria

Reassess when examples stop being initializer sources, the framework replaces
the trusted-proxy profile, the command or base-image decisions are superseded,
measured traffic invalidates the benchmark assumption, or equivalent evidence
can reduce maintenance or CI cost without weakening safety.

## Related Decisions

- [npm Scripts as the User-Facing Command Contract](0076-npm-scripts-as-the-user-facing-command-contract.proposed.md)
- [Digest-Pinned Official Node Builder and Distroless Runtime](0077-digest-pinned-official-node-builder-and-distroless-runtime.proposed.md)
- [Performance Budget for the Initial JSON HTTP Boundary](0014-performance-budget-initial-json-http-boundary.proposed.md)
- [Protected POST Progress Behind a Trusted Proxy](0068-protected-post-progress-behind-a-trusted-proxy.proposed.md)
