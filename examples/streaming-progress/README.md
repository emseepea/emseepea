# Streaming progress example

This private workspace shows one public tool using bounded, request-scoped
progress. The same `tools/call` returns JSON when the client does not request
progress and POST-scoped SSE when it supplies a progress token.

From the repository root:

```sh
npm run build
npm run start -w @emseepea/example-streaming-progress
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port. This initial slice is loopback-only: it has no GET stream,
session, replay, subscription, proxy, or multi-instance claim.

Run its three-trial semantic case with `npm run test:eval`. Authoritative
qualification remains release-gated by the exact CI commit.
