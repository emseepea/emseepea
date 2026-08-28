# Basic No-UI Example

This example exposes one self-contained, read-only `get-bean-details` tool
through the public `@emseepea/server` API. It is the shortest path from
validated input and output to a useful Model Context Protocol (MCP) tool.

## Boundary

- Model Context Protocol `2026-07-28` only
- Streamable HTTP `POST /mcp`
- JSON responses only for enabled methods
- Anonymous, loopback-only serving
- One read-only tool with sample data included in the example
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

Run the HTTP and client checks:

```sh
npm test
```

Run the language-model understanding check with `npm run test:eval`.
