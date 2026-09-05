---
status: "proposed"
date: 2026-09-05
human-oversight: confirmed
oversight-date: 2026-09-06
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-05
---

# Optional Deterministic HTTP Route Discovery

> Captured from Tom Howard's direction to make the UI examples demonstrate
> file-based routing while keeping the framework light and explicit.

## Context and Problem Statement

The HTML and React UI examples register every page, asset, and form handler in
their server entrypoints. This obscures the server assembly and teaches a
central route list that becomes noisy as files are added. ADR-0048 covers MCP
capability discovery, but it does not define discovery for ordinary HTTP
routes.

## Decision Drivers

- Keep example entrypoints focused on server assembly.
- Keep each HTTP handler close to the file or page it serves.
- Preserve direct Fastify route registration for small or unusual servers.
- Discover once at startup with deterministic, fail-closed behaviour.
- Keep examples as the only maintained initializer template source.
- Use Node built-ins and avoid a route-loader dependency.

## Considered Options

1. **Framework-owned optional HTTP route discovery (chosen)**: add a small
   public `@emseepea/server` API and use it in file-serving examples.
2. **Example-local route discovery**: copy a loader into each generated project.
3. **A Fastify autoload dependency**: adopt another package and its convention.
4. **Explicit inline routes only**: retain the current entrypoints.

## Decision Outcome

Chosen option: **"Framework-owned optional HTTP route discovery"**, because it
removes repeated route catalogues without copying infrastructure or adding a
dependency.

The public API registers routes from one local directory before serving starts.
Route modules use a documented method-first filename convention, with `index`
representing `/` and the remaining filename representing one root-level URL
segment. Each module exports only one default Fastify-compatible handler.
Discovery sorts filenames, rejects malformed route names, non-files, duplicate
method and path pairs, and source plus build collisions, and never selects a
winner from ambiguous modules.

Direct `app.get()`, `app.post()`, and other Fastify registration remain
supported. Route discovery is opt-in. Nested and parameterised filesystem
routes are deferred until a maintained example or adopter requirement needs
them.

## Consequences

### Good

- UI entrypoints show server composition instead of route plumbing.
- Generated projects inherit the same maintained route layout automatically.
- Route loading has one deterministic implementation and no new dependency.

### Neutral

- Method and path become part of the route filename.
- Discovery performs a bounded directory read and module imports at startup.

### Bad

- Moving or renaming a route file can change its public URL.
- The initial convention supports only root-level paths.

## Confirmation

- Both UI examples and their generated projects register file and page routes
  through the public discovery API.
- Existing direct Fastify registration continues to work.
- Repeated discovery registers routes in the same order.
- Tests reject malformed names, non-files, duplicate method and path pairs,
  source plus build collisions, unsupported exports, and non-file roots.
- UI browser accessibility, lint, ordinary tests, semantic tests, and packed
  standalone initializer qualification pass unchanged.

## Pros and Cons of the Options

### Framework-owned optional HTTP route discovery

- Good, because every adopter uses one checked implementation.
- Bad, because the filename convention becomes public framework API.

### Example-local route discovery

- Good, because the framework API stays smaller.
- Bad, because generated projects own copied infrastructure instead of only
  application routes.

### A Fastify autoload dependency

- Good, because it provides an established loader.
- Bad, because the examples need only a small bounded convention and would add
  another dependency and abstraction.

### Explicit inline routes only

- Good, because it requires no new API.
- Bad, because file-serving examples keep a noisy central route catalogue.

## Reassessment Criteria

Reassess if a maintained example needs nested or parameterised HTTP paths, the
startup scan becomes measurably expensive, Fastify provides the required
behaviour without another dependency, or route modules need lifecycle features
that a default handler cannot express.
