# Basic No-UI Example

This example exposes one synthetic, read-only coffee-bean lookup through the
public `@emseepea/server` API.

## Boundary

- MCP `2026-07-28` only
- Streamable HTTP `POST /mcp`
- JSON responses only for enabled methods
- Anonymous, loopback-only serving
- One read-only tool
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
