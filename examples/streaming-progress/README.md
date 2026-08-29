# Streaming Progress Example

Choose this example when a tool takes long enough that people benefit from
seeing progress before the final answer.

The public tool reports progress during its request. A client can ask for
server-sent events (SSE), which carry progress over the same `POST` request.
Without that request, the tool returns one JSON response when it finishes.

## Run

From the repository root:

```sh
npm install
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
