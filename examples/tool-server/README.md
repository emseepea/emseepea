# `@emseepea/create-tool-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template for the smallest server with one public, read-only tool and
no external service, sign-in, web page, progress stream, or shared storage.
Choose the [API-backed server](../api-backed-server/README.md) when the tool
must call a public web service. [Compare all eight templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/tool-server -- my-server
```

<!-- generated-project-readme -->

## Your First Public Tool

Choose this example when you want the smallest working server with one public,
read-only tool and no web page.

The `get-pea-variety` tool returns useful details about one sample pea variety. Em
See Pea checks the input and result before returning them through the public
`@emseepea/server` API.

## What This Example Includes

- Model Context Protocol (MCP) `2026-07-28` over `POST /mcp`
- one public, read-only tool with sample data
- checks for tool input and output
- local use on your computer only

It does not include sign-in, saved sessions, live progress, changes to data, or
production network setup.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The endpoint is `http://127.0.0.1:3000/mcp` and the health check is
`http://127.0.0.1:3000/healthz`.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI tool-choice and understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build and MCP checks:

```sh
npm test
```

Check that Claude chooses the variety tool and understands its result:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
