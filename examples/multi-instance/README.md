# Multi-Instance Example

This example starts two Em See Pea server processes on one computer. Each
process has its own Fastify app and SQLite connection. Both connections use the
same local database file.

It demonstrates one narrow guarantee: the same request ID creates one stored
bean report. A retry through either server returns that original report.

It does not work across multiple computers, and it does not promise that a
retry changes an external service only once.

## Run Both Servers

From the repository root:

```sh
npm run build
npm run start:multi-instance
```

The command prints two MCP addresses. Stop it with Control-C.

## Tools

- `create-shared-bean-report` creates or replays a stored report for a request
  ID. The report explains which server originally created it.
- `describe-instance` returns the server name and does not use SQLite.

The report tool checks SQLite before mapping or backend work. If SQLite becomes
unavailable, that tool returns a generic failure. It stays visible in
`tools/list`; `describe-instance` and `/readyz` keep working.

## Exact Scope

- Two server processes on one host.
- One SQLite file with separate connections.
- One database transaction per report request.
- No claim for multiple computers, external service changes, retries, or
  throughput.

## Check This Example

Run its build and two-server MCP checks:

```sh
npm test -w @emseepea/example-multi-instance
```

Check that Claude understands report replay correctly:

```sh
npm run test:llm -w @emseepea/example-multi-instance
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
