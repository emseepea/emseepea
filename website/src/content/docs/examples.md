---
title: Choose an example
description: Find a starting point for tools, APIs, sign-in, progress, forms, or shared reports.
---

Each initializer creates a private standalone project with application code,
ordinary tests in `test/`, and language-model tests in `eval/`. Capability
modules live in `src/capabilities/` and are discovered once at startup. Replace
`my-server` with an unused directory name. The [first-server guide](../getting-started/)
continues from the tool server starter.

For each starter, the linked GitHub example directory contains the public
initializer package, README, changelog, and maintained example source. The
commands use the default npm release channel.

## Answer questions about your data

**Tool server.** Read details from a small in-memory catalogue.
Use it to learn the tool definition without another service to configure.

```sh
npm init @emseepea/tool-server -- my-server
```

[Read the tool server example](https://github.com/emseepea/emseepea/tree/main/examples/tool-server).

## Connect a public API

**API-backed server.** Call an external JSON API and return selected, checked
fields as an MCP result. The example preserves useful service values instead of
maintaining a second closed list that needs another release when the service adds
a valid value.

```sh
npm init @emseepea/api-backed-server -- my-server
```

[Read the API-backed server example](https://github.com/emseepea/emseepea/tree/main/examples/api-backed-server).

## Require sign-in for a tool

Anyone can discover the server and list tools. Calling the restricted tool
requires the example's made-up access token. Replace that token checker before
using it in a real application.

```sh
npm init @emseepea/sign-in-tool-server -- my-server
```

[Read the sign-in tool server example](https://github.com/emseepea/emseepea/tree/main/examples/sign-in-tool-server).

## Share reference material and prompts

Provide readable resources, resource addresses with parameters, reusable
prompts, and suggestions for prompt fields.

```sh
npm init @emseepea/resources-and-prompts-server -- my-server
```

[Read the resources and prompts server example](https://github.com/emseepea/emseepea/tree/main/examples/resources-and-prompts-server).

## Report progress during a tool call

Send updates over the call's open HTTP connection, then return the final
result. This is not a saved session or a reconnectable subscription.

```sh
npm init @emseepea/progress-streaming-server -- my-server
```

[Read the progress-streaming server example](https://github.com/emseepea/emseepea/tree/main/examples/progress-streaming-server).

## Add a web form

The native HTML and React examples show the same pea planting-plan form. Choose native
HTML for fewer dependencies, or React to fit an existing React application.
The HTML example keeps page, form, and stylesheet handlers in `src/routes/`.
The React example also keeps its browser-script handler there. Both register
the routes once during startup.

For native HTML:

```sh
npm init @emseepea/html-ui-server -- my-server
```

For React:

```sh
npm init @emseepea/react-ui-server -- my-server
```

[Read the HTML UI server example](https://github.com/emseepea/emseepea/tree/main/examples/html-ui-server)
or [the React UI server example](https://github.com/emseepea/emseepea/tree/main/examples/react-ui-server).

## Share a report store between two processes

Two local servers use the same SQLite store. Repeating a report request with
the same request ID creates one stored report. This does not guarantee
exactly-once changes to an external service or support multiple computers.

```sh
npm init @emseepea/multi-instance-sqlite-server -- my-server
```

[Read the multi-instance SQLite server example](https://github.com/emseepea/emseepea/tree/main/examples/multi-instance-sqlite-server).
