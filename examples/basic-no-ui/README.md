# Basic No-UI Example

This example exposes one self-contained, read-only `get-bean-details` tool
through the public `@emseepea/server` API. It is the shortest path from a Zod
input and output contract to a useful MCP tool.

## Boundary

- MCP `2026-07-28` only
- Streamable HTTP `POST /mcp`
- JSON responses only for enabled methods
- Anonymous, loopback-only serving
- One read-only tool with inline synthetic data
- No sessions, replay, subscriptions, effects, authentication, or production
  network exposure

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:basic
```

The endpoint is `http://127.0.0.1:3000/mcp` and the health check is
`http://127.0.0.1:3000/healthz`.

## Smoke Test

Run the raw-wire and independent-client checks:

```sh
npm test
```

Run this example's three-trial semantic MCP case with `npm run test:eval`.
