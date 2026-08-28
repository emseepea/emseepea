# Streaming Progress Example

This example shows one public tool that reports progress during a
request. If the client asks for progress, the server sends server-sent events
(SSE) over the same POST request. If not, the tool returns one JSON response.

## Run

From the repository root:

```sh
npm run build
npm run start -w @emseepea/example-streaming-progress
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port. This initial slice is loopback-only: it has no GET stream,
session, replay, subscription, proxy, or multi-instance claim.

## Check This Example

Run its build and progress-stream checks:

```sh
npm test -w @emseepea/example-streaming-progress
```

Check that Claude keeps progress updates and the final result distinct:

```sh
npm run test:llm -w @emseepea/example-streaming-progress
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
