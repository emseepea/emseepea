# Em See Pea

Em See Pea is a general-purpose framework for MCP `2026-07-28` servers over
Streamable HTTP.

The project is pre-alpha. The current qualified slice is a Fastify-first,
JSON-only MCP server with public tools, invocation-scoped OAuth-protected
tools, and one synthetic read-only example. Checked backend adapters and their
second example are implemented but remain a candidate until the exact committed
revision passes the Node.js 22 and 24 clean-checkout gates.

## Operating Documents

- [Battle plan](BATTLE-PLAN.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.proposed.md)
- [Anonymous production boundary][production-boundary]
- [Public discovery and protected invocation][public-discovery]
- [Trusted pre-alpha release governance][release-governance]
- [Quality policy](QUALITY.md)
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

## Initial Technical Baseline

- Node.js 22 and 24
- TypeScript 6
- npm workspaces with one root lockfile
- `@emseepea/server` using Fastify 5
- Official MCP server, Node, and Fastify packages at 2.0.0
- Anonymous MCP and OAuth resource-server metadata discovery
- Per-tool public or OAuth-protected access with required scopes
- Basic and backend no-UI examples importing only the public package

The source and examples are public under MIT. Only `@emseepea/server@0.0.1` is
eligible for initial npm publication under the `next` tag; the root and examples
remain private npm workspaces.

## Check the Current Boundary

```sh
npm ci --ignore-scripts
npm test
```

The test compiles every workspace, exercises the real Fastify HTTP endpoint
with raw requests, and calls it with the official client pinned to
`2026-07-28`. It covers discovery, tool listing and calls, validation,
cancellation, request limits, safe errors, loopback binding, and the explicit
single-instance anonymous profile behind a trusted HTTPS proxy. It also proves
that OAuth metadata, `server/discover`, and `tools/list` remain anonymous while
missing, invalid, expired, wrong-scope, wrong-resource, and timed-out protected
calls cause zero tool-handler calls. Mapped-tool tests prove independent public,
backend-command, backend-result, and final-output validation across memory and
file adapters, with one adapter call, shared deadlines, disconnect cancellation,
and redacted failures.

Run the provisional JSON-boundary performance gate separately:

```sh
npm run benchmark
```

The OAuth slice validates bearer-token expiry, required scopes, and resource
using the official SDK boundary. The adopter's `OAuthTokenVerifier` remains
responsible for issuer and token-integrity validation and for independently
bounding or cancelling its own I/O. Object or tenant authorization, safe
outbound HTTP policy, retries, effects, SSE responses, shared state, React, and Tailwind are not
implemented or claimed by this slice. Publication does not expand these claims.

[production-boundary]: docs/decisions/0002-anonymous-production-boundary.proposed.md
[public-discovery]: docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md
[release-governance]: docs/decisions/0019-public-pre-alpha-releases-through-npm-trusted-publishing.proposed.md
