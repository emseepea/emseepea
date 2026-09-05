---
title: Choose an example
description: Find a starting point for tools, APIs, sign-in, progress, forms, or shared reports.
---

Each initializer creates a private standalone project with application code,
ordinary tests in `test/`, and language-model tests in `eval/`. Capability
modules live in `src/capabilities/` and are discovered once at startup. Replace
`my-server` with an unused directory name. The [first-server guide](../getting-started/)
continues from the public-tool starter.

For each starter, the linked GitHub example directory contains the public
initializer package, README, changelog, and maintained example source. The
`next` tag selects the pre-alpha release on npm.

## Answer questions about your data

**Basic coffee tool.** Read details from a small in-memory catalogue.
Use it to learn the tool definition without another service to configure.

```sh
npm init @emseepea/tool-server@next -- my-server
```

[Read the basic example](https://github.com/emseepea/emseepea/tree/main/examples/basic-no-ui).

## Connect a public API

**Public web service.** Call an external JSON API and return selected, checked
fields as an MCP result. The example preserves useful service values instead of
maintaining a second closed list that needs another release when the service adds
a valid value.

```sh
npm init @emseepea/api-backed-server@next -- my-server
```

[Read the backend example](https://github.com/emseepea/emseepea/tree/main/examples/backend-no-ui).

## Require sign-in for a tool

Anyone can discover the server and list tools. Calling the restricted tool
requires the example's made-up access token. Replace that token checker before
using it in a real application.

```sh
npm init @emseepea/sign-in-tool-server@next -- my-server
```

[Read the sign-in example](https://github.com/emseepea/emseepea/tree/main/examples/protected-no-ui).

## Share reference material and prompts

Provide readable resources, resource addresses with parameters, reusable
prompts, and suggestions for prompt fields.

```sh
npm init @emseepea/resources-and-prompts-server@next -- my-server
```

[Read the resources and prompts example](https://github.com/emseepea/emseepea/tree/main/examples/resources-prompts).

## Report progress during a tool call

Send updates over the call's open HTTP connection, then return the final
result. This is not a saved session or a reconnectable subscription.

```sh
npm init @emseepea/progress-streaming-server@next -- my-server
```

[Read the progress example](https://github.com/emseepea/emseepea/tree/main/examples/streaming-progress).

## Add a web form

The native HTML and React examples show the same coffee form. Choose native
HTML for fewer dependencies, or React to fit an existing React application.

For native HTML:

```sh
npm init @emseepea/html-ui-server@next -- my-server
```

For React:

```sh
npm init @emseepea/react-ui-server@next -- my-server
```

[Read the native HTML example](https://github.com/emseepea/emseepea/tree/main/examples/native-ui)
or [the React example](https://github.com/emseepea/emseepea/tree/main/examples/react-tailwind-ui).

## Share a report store between two processes

Two local servers use the same SQLite store. Repeating a report request with
the same request ID creates one stored report. This does not guarantee
exactly-once changes to an external service or support multiple computers.

```sh
npm init @emseepea/multi-instance-sqlite-server@next -- my-server
```

[Read the two-process example](https://github.com/emseepea/emseepea/tree/main/examples/multi-instance).
