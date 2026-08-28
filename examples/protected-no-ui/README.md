# Sign-In No-UI Example

This local-only example lets anyone discover the Model Context Protocol (MCP)
server and list its tools. Calling `get-private-inventory-report` requires the
`inventory:read` permission. The report distinguishes stock on hand, reserved
stock, stock available to promise, and incoming stock.

The token `example-access-token` and every sign-in address in this example are
made up and safe to publish. The example shows where an application connects
its own token checker. It does not validate a real token or provide production
sign-in.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:protected
```

The endpoint is `http://127.0.0.1:3000/mcp`. Clients may discover and list
without signing in. Use `example-access-token` only to try the tool locally.

## Check This Example

Run its build, public discovery, and signed-in tool checks:

```sh
npm test -w @emseepea/example-protected-no-ui
```

Check that Claude calculates available stock correctly:

```sh
npm run test:llm -w @emseepea/example-protected-no-ui
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
