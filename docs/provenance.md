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
| [Node.js release schedule](https://nodejs.org/en/about/previous-releases) | Consulted 2026-08-26 | Node.js 24 LTS selection and Node.js 20 exclusion |

## Approved Dependencies

| Package | Pinned version | Licence | Reason |
| --- | --- | --- | --- |
| `@modelcontextprotocol/server` | `2.0.0` | MIT | Official modern MCP server and schemas |
| `@modelcontextprotocol/node` | `2.0.0` | MIT | Maintained Node HTTP adapter |
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
