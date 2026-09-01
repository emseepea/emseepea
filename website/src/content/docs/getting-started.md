---
title: Run your first server
description: Copy a tested MCP example into your own project and make it yours.
example: basic-no-ui
---

Start with the coffee example. It answers questions about the origin, roast,
processing method, and tasting notes of two made-up coffees. It includes both
ordinary tests and tests of AI tool choice and explanations.

You need Git, Node.js 22 or 24, and npm. This is a local development quickstart,
not production deployment guidance.

## Copy the example

Run these commands from a directory where you keep projects. Choose another
name if `my-mcp` or `emseepea` already exists.

```sh title="Copy the example"
git clone https://github.com/windyroad/emseepea.git
cp -R emseepea/examples/basic-no-ui my-mcp
cd my-mcp
```

Your project is now separate from the monorepo. It uses `@emseepea/server`
0.0.3 and `@emseepea/testing` 0.1.0 from npm. Both packages are pre-alpha.

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

> What are the origin, processing method, roast, and tasting notes of Highland Bloom?

Client setup varies. Older clients may not support this protocol version.
The example's tests use the matching official MCP client.

## Make it yours

Open `src/server.ts` in your project:

- `beans` contains the sample data. Replace it with your own data.
- `inputSchema` describes the names the tool accepts.
- `outputSchema` describes the details it returns.
- `handler` looks up the coffee and returns text plus structured data.

Em See Pea checks the input and output. Your handler supplies the behaviour.
Update `test/server.test.mjs` for your data, then run `npm test` again.

## Check the AI's tool choice and explanation

The example's `eval/meaning.test.mjs` checks that a model does not confuse
origin, variety, processing, and roast. Adapt its question and expected facts
when you change the tool.

This check requires a signed-in Claude CLI and uses model allowance. See
[the AI testing guide](../ai-tests/) for setup and what the results prove.

```sh title="Check AI tool choice and understanding"
npm run test:llm
```

The model sees the advertised tools and must select `get-bean-details` with
arguments that the real server accepts. The test then checks whether the model
understands the returned coffee details.

## Add another capability

[Browse the examples](../examples/) to connect a public API, add sign-in,
send progress updates, or add a web form.
