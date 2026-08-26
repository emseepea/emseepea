# Em See Pea

Em See Pea is a clean-room, general-purpose framework for MCP `2026-07-28`
servers over Streamable HTTP.

The project is pre-alpha. The current scaffold does not compile, so no runtime
capability is claimed yet.

## Operating Documents

- [Battle plan](BATTLE-PLAN.md)
- [Clean-room boundary](CLEAN-ROOM.md)
- [Foundation decision](docs/decisions/0001-foundation.proposed.md)
- [Anonymous production boundary][production-boundary]
- [Repository and release governance][release-governance]
- [Guide amendment](docs/guide-amendments/0001-adaptive-delivery-and-ordinary-evidence.md)
- [Source provenance](docs/provenance.md)
- [Quality policy](QUALITY.md)
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

## Initial Technical Baseline

- Node.js 24 LTS
- TypeScript 6
- npm workspaces with one root lockfile
- Official MCP TypeScript SDK 2.0.0
- One publishable framework package until a real consumer proves a split
- Server-rendered semantic HTML for the first UI examples

The source and examples are public under MIT. npm publication remains disabled
until the package identity and first supported boundary are approved.

## Check the Current Boundary

```sh
npm ci --ignore-scripts
npm test
```

The intended test compiles both workspaces, exercises the real HTTP endpoint
with raw requests, and calls it with the official client pinned to
`2026-07-28`. It must pass before this README claims that boundary.

[production-boundary]: docs/decisions/0002-anonymous-production-boundary.proposed.md
[release-governance]: docs/decisions/0003-public-repository-and-release-governance.proposed.md
