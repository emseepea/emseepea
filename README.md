# Em See Pea

Em See Pea is a clean-room, general-purpose framework for MCP `2026-07-28`
servers over Streamable HTTP.

The project is pre-alpha. The current qualified slice is a Fastify-first,
JSON-only MCP server with one synthetic read-only example.

## Operating Documents

- [Battle plan](BATTLE-PLAN.md)
- [Clean-room boundary](CLEAN-ROOM.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.proposed.md)
- [Anonymous production boundary][production-boundary]
- [Public discovery and protected invocation][public-discovery]
- [Repository and release governance][release-governance]
- [Guide amendment](docs/guide-amendments/0001-adaptive-delivery-and-ordinary-evidence.md)
- [Source provenance](docs/provenance.md)
- [Quality policy](QUALITY.md)
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

## Initial Technical Baseline

- Node.js 22 and 24
- TypeScript 6
- npm workspaces with one root lockfile
- `@emseepea/server` using Fastify 5
- Official MCP server, Node, and Fastify packages at 2.0.0
- One private no-UI example importing only the public package

The source and examples are public under MIT. npm publication remains disabled
until the package identity and first supported boundary are approved.

## Check the Current Boundary

```sh
npm ci --ignore-scripts
npm test
```

The test compiles both workspaces, exercises the real Fastify HTTP endpoint
with raw requests, and calls it with the official client pinned to
`2026-07-28`. It covers discovery, tool listing and calls, validation,
cancellation, request limits, safe errors, loopback binding, and the explicit
single-instance anonymous profile behind a trusted HTTPS proxy.

Run the provisional JSON-boundary performance gate separately:

```sh
npm run benchmark
```

OAuth, protected tools, SSE responses, shared state, React, and Tailwind are not
implemented or claimed by this slice. npm publication remains disabled.

[production-boundary]: docs/decisions/0002-anonymous-production-boundary.proposed.md
[public-discovery]: docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md
[release-governance]: docs/decisions/0003-public-repository-and-release-governance.proposed.md
