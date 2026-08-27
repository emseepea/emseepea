# Source Provenance

## Rules

- Record public sources when first used for a decision, fixture, or behavior.
- Prefer versioned authoritative sources.
- Pin dependencies in `package-lock.json`; its registry integrity hashes are the
  dependency artifact record.
- Do not store or reference restricted implementation material.

## Approved Design Inputs

| Source | Version or digest | Use |
| --- | --- | --- |
| Named clean-room implementation guide | SHA-256 `c7940e5bf26abe65915b996ebf0812fabb6f97d91567653a76018717a8e747de` | Framework requirements and acceptance inventory |
| [Guide Amendment 0001](guide-amendments/0001-adaptive-delivery-and-ordinary-evidence.md) | 2026-08-26 | Adaptive delivery and ordinary qualification evidence |
| [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28/) | `2026-07-28`, consulted 2026-08-26 | Authoritative protocol baseline |
| [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) | `2026-07-28`, consulted 2026-08-26 | POST transport, headers, JSON/SSE, cancellation, and legacy exclusions |
| [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) | `2026-07-28`, consulted 2026-08-26 | Mandatory `server/discover` behavior |
| [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) | `2026-07-28`, consulted 2026-08-26 | Tool listing, calls, schemas, results, and errors |
| [Schema reference](https://modelcontextprotocol.io/specification/2026-07-28/schema) | `2026-07-28`, consulted 2026-08-26 | Authoritative public message shapes and error codes |
| [MCP release announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/) | 2026-07-28, consulted 2026-08-26 | Release status and SDK support cross-check |
| [Node.js release schedule](https://nodejs.org/en/about/previous-releases) and [release index](https://nodejs.org/dist/index.json) | Consulted 2026-08-27 | Node.js 22.23.2 and 24.20.0 qualification pins and Node.js 20 exclusion |

## Approved Dependencies

| Package | Pinned version | Licence | Reason |
| --- | --- | --- | --- |
| `@modelcontextprotocol/fastify` | `2.0.0` | MIT | Official Fastify integration for MCP servers |
| `@modelcontextprotocol/server` | `2.0.0` | MIT | Official modern MCP server, schemas, bearer verification, OAuth challenges, and resource metadata helpers |
| `@modelcontextprotocol/node` | `2.0.0` | MIT | Maintained Node HTTP adapter |
| `fastify` | `5.12.1` | MIT | Fastify-first application and HTTP lifecycle |
| `zod` | `4.4.3` | MIT | SDK-compatible runtime schema validation |
| `typescript` | `6.0.3` | Apache-2.0 | Static compilation |
| `@types/node` | `24.13.3` | MIT | Node.js 24 type definitions |

Package metadata was obtained from the public npm registry on 2026-08-26. The
lockfile becomes authoritative for resolved transitive versions and integrity
hashes after installation.

## Approved Process Inputs

These sources are generic QA and release-process precedent only. They are not
implementation evidence, and no product source, test body, fixture, schema, MCP
behavior, deployment logic, or domain rule may be copied from them.

| Source | Revision | Process lessons used |
| --- | --- | --- |
| `voder-mcp-hub` | `d0a862fbc8f599fe80f2ce90a1856cb2768bdffe` | Assert the actual public claim, test current source rather than stale output, include scripts and tests in quality coverage, pin Actions immutably, and keep quality separate from release |
| `windyroad/home-loan-mcp` | `6f16b56592faf96100333356cdb4c8fc5401544b` | Keep the clean-checkout sequence direct: typecheck, test, build, then public-contract checks; add explicit light and dark contrast gates when UI exists |

## Approved Automation Dependencies

| Dependency | Pin | Licence | Use |
| --- | --- | --- | --- |
| `actions/checkout` | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` (`v5.1.0`) | MIT | Clean GitHub-hosted checkout |
| `actions/setup-node` | `a0853c24544627f65ddf259abe73b1d18a591444` (`v5.0.0`) | MIT | Node.js 22 and 24 matrix setup with npm caching |
| `changesets/action` | `a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d` (`v1.9.0`) | MIT | Create or update the release pull request without publishing |
| `@changesets/cli` | `3.0.1` | MIT | Version private workspace packages inside the release pull request |
| `@changesets/changelog-github` | `1.0.0` | MIT | Generate the changelog consumed by the Changesets release pull request |

The three pinned Actions use the Node.js 24 action runtime. Their public action
manifests, tag targets, and repository licences were verified on 2026-08-26.
