# Resources and Prompts Example

This example exposes three public MCP features through
`@emseepea/server`: one fixed resource, one resource address pattern, and one
prompt. The resource pattern and prompt argument can offer checked suggestions.

## Run

From the repository root:

```sh
npm run build
npm run start -w @emseepea/example-resources-prompts
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port.

## Check This Example

Run its build and MCP resource and prompt checks:

```sh
npm test -w @emseepea/example-resources-prompts
```

Check that Claude keeps coffee strength and extraction distinct:

```sh
npm run test:llm -w @emseepea/example-resources-prompts
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
