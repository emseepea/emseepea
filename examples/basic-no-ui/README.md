# Your First Public Tool

Choose this example when you want the smallest working server with one public,
read-only tool and no web page.

The `get-bean-details` tool returns useful details about one sample coffee. Em
See Pea checks the question and result before returning them through the public
`@emseepea/server` API.

## What This Example Includes

- Model Context Protocol (MCP) `2026-07-28` over `POST /mcp`
- one public, read-only tool with sample data
- checks for tool input and output
- local use on your computer only

It does not include sign-in, saved sessions, live progress, changes to data, or
production network setup.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:basic
```

The endpoint is `http://127.0.0.1:3000/mcp` and the health check is
`http://127.0.0.1:3000/healthz`.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build and MCP checks:

```sh
npm test -w @emseepea/example-basic-no-ui
```

Check that Claude understands the result correctly:

```sh
npm run test:llm -w @emseepea/example-basic-no-ui
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
