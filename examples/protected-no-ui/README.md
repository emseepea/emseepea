# `@emseepea/create-sign-in-tool-server`

This directory is both the maintained example and its public npm initializer.

```sh
npm init @emseepea/sign-in-tool-server@next -- my-server
```

<!-- generated-project-readme -->

## Sign-In Tool Example

Choose this example when people should be able to discover your server and its
tools without signing in, but must sign in before a particular tool runs.

This local-only example lets anyone discover the Model Context Protocol (MCP)
server and list its tools. Calling `get-private-inventory-report` requires the
`inventory:read` permission. The report distinguishes stock on hand, reserved
stock, stock available to promise, and incoming stock.

The token `example-access-token` and every sign-in address in this example are
made up and safe to publish. The example shows where an application connects
its own token checker. It does not validate a real token or provide production
sign-in.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The endpoint is `http://127.0.0.1:3000/mcp`. Clients may discover and list
without signing in. Use `example-access-token` only to try the tool locally.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI tool-choice and understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build, public discovery, and signed-in tool checks:

```sh
npm test
```

Check that Claude chooses the inventory report and calculates available stock:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
