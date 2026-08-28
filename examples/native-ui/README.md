# Native UI Example

This example adds one server-rendered form to the Fastify Model Context
Protocol (MCP) server. It uses the native renderer and the same sample states as
the React example.

## Run

From the repository root, run `npm run build`, then
`npm run start:native-ui`. Open
`http://127.0.0.1:3000/` for the page or use
`http://127.0.0.1:3000/mcp` for Model Context Protocol (MCP).

The page previews content only. It does not send or store a report.

## Check This Example

Run its build, browser, keyboard, and accessibility checks:

```sh
npm test -w @emseepea/example-native-ui
```

Check that Claude understands that a preview changes nothing:

```sh
npm run test:llm -w @emseepea/example-native-ui
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
