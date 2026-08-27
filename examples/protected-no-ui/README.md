# Protected No-UI Example

This loopback-only example keeps Model Context Protocol (MCP) discovery and
tool listing public while requiring the `inventory:read` scope to call
`get-private-inventory-report`. The report distinguishes stock on hand,
reserved stock, stock available to promise, and inbound stock.

The token `example-access-token` and every OAuth authorization URL in this
example are public synthetic test data. The verifier demonstrates Em See Pea's
integration boundary; it does not validate a real token or represent production
OAuth authorization.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:protected
```

The endpoint is `http://127.0.0.1:3000/mcp`. Clients may discover and list
without credentials. Use `example-access-token` only to exercise the protected
tool locally.

Run the HTTP-boundary checks with `npm test`.
Run this example's three-trial semantic Model Context Protocol (MCP) case with
`npm run test:eval`.
