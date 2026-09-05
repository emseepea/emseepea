---
title: Run your first server
description: Create a tested MCP server project and make it yours.
example: tool-server
---

Start with the tool server example. It answers questions about the type, growth
habit, maturity time, and traits of two made-up pea varieties. It includes both
ordinary tests and tests of AI tool choice and explanations.

You need Git, Node.js 22 or 24, and npm. This is a local development quickstart,
not production deployment guidance.

The [tool server example directory](https://github.com/emseepea/emseepea/tree/main/examples/tool-server)
contains the maintained source and the public initializer package used below.

## Create the project

Run this command from a directory where you keep projects. Choose another name
if `my-mcp` already exists.

```sh title="Create the project"
npm init @emseepea/tool-server -- my-mcp
cd my-mcp
```

The initializer creates a private standalone project. Its `package.json` uses
the pre-alpha versions of `@emseepea/server` and `@emseepea/testing`.

## Install and check it

Run these commands inside `my-mcp`:

```sh title="Install and check"
npm install --ignore-scripts
npm test
npm run lint
```

The tests build your server and call it through MCP. They do not require a
language-model account. A passing run ends with no failed tests.

## Start your server

```sh title="Start the server"
npm start
```

The terminal prints its local MCP address, normally
`http://127.0.0.1:3000/mcp`. Keep that terminal open while using the server.
Stop it with Control-C. If port 3000 is in use, stop the other local example first.

Connect using an MCP client that supports MCP `2026-07-28` and Streamable HTTP.
Add the printed address to that client's server connections, then try asking:

> What are the pea type, growth habit, days to maturity, and traits of Highland Snap?

Client setup varies. Older clients may not support this protocol version.
The example's tests use the matching official MCP client.

## Make it yours

Open `src/capabilities/tool.get-pea-variety.ts` in your project:

- `varieties` contains the sample data. Replace it with your own data.
- `inputSchema` describes the names the tool accepts.
- `outputSchema` describes the details it returns.
- `handler` looks up the pea variety and returns text plus structured data.

Em See Pea checks the input and output. Your handler supplies the behaviour.
Update `test/server.test.mjs` for your data, then run `npm test` again.

`src/server.ts` calls `discoverCapabilities(new URL("./capabilities/", import.meta.url))`
once during startup. Explicit `tools`, `resources`, and `prompts` arrays still
work when you need them.

## Check the AI's tool choice and explanation

The example's `eval/meaning.test.mjs` checks that a model does not confuse pea
type, growth habit, maturity time, and traits. Adapt its question and expected facts
when you change the tool.

This check requires a signed-in Claude CLI and uses model allowance. See
[the AI testing guide](../ai-tests/) for setup and what the results prove.

```sh title="Check AI tool choice and understanding"
npm run test:llm
```

The model sees the advertised tools and must select `get-pea-variety` with
arguments that the real server accepts. The test then checks whether the model
understands the returned pea variety details.

## Add another capability

[Browse the examples](../examples/) to connect a public API, add sign-in,
send progress updates, or add a web form.
