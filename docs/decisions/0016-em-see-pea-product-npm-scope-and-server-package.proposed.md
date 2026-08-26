---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0004"]
---

# Em See Pea Product npm Scope with Server-Named Runtime

## Context and Problem Statement

Em See Pea now has the free public `@emseepea` npm organisation, while the
ratified repository and framework decisions still name `@windyroad/emseepea`
and deliberately defer registry identity. The package family needs one durable
identity before manifests, imports, examples, Changesets configuration, and
public documentation become harder to rename.

The identity decision must preserve the existing product foundation: the
authoritative repository remains public `windyroad/emseepea` under MIT; Fastify
5 and the official MCP Fastify adapter remain the only HTTP boundary; packages
remain private and unpublished until the release gate is separately opened.

## Decision Drivers

- Make the product name visible and consistent across npm packages.
- Describe the Fastify-first runtime honestly instead of implying a generic core.
- Keep React and Tailwind as narrow optional packages with little adopter boilerplate.
- Preserve Windy Road ownership, the public repository, and gated Changesets releases.
- Avoid a second namespace migration after examples and adopters exist.

## Considered Options

1. **Product scope with role-specific package names** - Use
   `@emseepea/server`, `@emseepea/react`, and `@emseepea/tailwind`, with private
   examples under `@emseepea/example-*`.
2. **Windy Road scope with product-named packages** - Retain
   `@windyroad/emseepea` and use longer Windy Road-scoped names for optional
   packages.
3. **Product scope with a generic core package** - Use `@emseepea/core` for the
   runtime plus `@emseepea/react` and `@emseepea/tailwind`.

## Decision Outcome

Chosen option: **"Product scope with role-specific package names"**, because
`@emseepea/server` is concise, groups the product family under its own public
npm identity, and accurately signals the ratified Fastify-first server
foundation.

The first runtime package is `@emseepea/server`. The optional UI packages are
`@emseepea/react` and `@emseepea/tailwind`. Private example workspaces use the
`@emseepea/example-*` pattern and are never published.

Windy Road Technology controls the npm organisation and remains the publisher.
The authoritative source repository remains public `windyroad/emseepea` under
MIT. The monorepo continues to use TypeScript 6, npm workspaces with one root
lockfile, Fastify 5, `@modelcontextprotocol/server@2.0.0`, and
`@modelcontextprotocol/fastify@2.0.0`. No generic transport or public Web
`fetch` handler is introduced.

The root and all packages remain private. Changesets may maintain a release
pull request but has no npm publish command or registry credential. Creating
the npm organisation does not authorize publication. A later reviewed decision
must open trusted publishing only after support boundaries, provenance,
permissions, and clean-checkout qualification pass.

## Consequences

### Good

- Imports form a short, recognizable product family.
- `server` communicates the Fastify-first runtime boundary more honestly than `core`.
- Optional React and Tailwind packages have predictable names.
- Windy Road ownership and the existing public repository remain unchanged.

### Neutral

- The npm organisation and GitHub organisation intentionally have different names.
- Private example workspaces share the product scope locally but are not registry packages.

### Bad

- All current manifests, imports, lockfile entries, documentation, and release
  configuration must change together.
- npm organisation administration adds a separate 2FA, membership, and trusted
  publishing boundary.
- Renaming after publication would be materially disruptive, so this decision
  must be confirmed before the first release.

## Confirmation

- Workspace manifests and imports use `@emseepea/server` and no longer use
  `@windyroad/emseepea`.
- Optional UI documentation uses `@emseepea/react` and `@emseepea/tailwind`.
- Private example names follow `@emseepea/example-*` and remain ignored by Changesets.
- The runtime depends on Fastify 5 and `@modelcontextprotocol/fastify@2.0.0`.
- Clean installs, builds, and tests pass on Node.js 22 and 24.
- Real Fastify HTTP tests cover discovery, tool listing, tool calls, malformed
  input, disabled capabilities, limits, cancellation, and safe errors.
- An independent MCP client interoperates through the Fastify endpoint.
- Examples use only the public Em See Pea API for MCP behavior.
- No public generic request handler, server adapter, or caller-supplied
  capability map exists.
- The public repository remains `windyroad/emseepea` under MIT.
- Every package and the root remain private, and no workflow can publish to npm.
- npm publication requires a later reviewed decision and trusted-publishing setup.

## Pros and Cons of the Options

### Product scope with role-specific package names

- Good: Produces concise imports and an extensible product family.
- Good: `server` accurately names the Fastify-first runtime.
- Bad: Requires a coordinated pre-release rename.

### Windy Road scope with product-named packages

- Good: Preserves current manifests and established publisher branding.
- Bad: Produces longer names and obscures the product family.

### Product scope with a generic core package

- Good: Uses the new product scope with a conventional package label.
- Bad: `core` suggests server or transport neutrality that the architecture rejects.

## Reassessment Criteria

Reassess if npm scope ownership changes, a real adopter requires a second server
or transport, optional packages need independent release identities, or trusted
publishing is ready for review.
