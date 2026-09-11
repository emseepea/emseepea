# `@emseepea/create-tool-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template for the smallest server with one read-only tool and no
external service, web page, progress stream, or shared storage.
Choose the [API-backed server](../api-backed-server/README.md) when the tool
must call a public web service. [Compare all templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/tool-server -- my-server
```

<!-- generated-project-readme -->

## Choose Open or Protected Access

Start open when the catalogue and operations are public.

To protect this template, pass both options to the app factory:

- `access: { access: "protected", requiredScopes: ["peas:read"] }`
- an `authentication` adapter

Keep `authentication.discovery` as `"public"` unless capability names or
schemas are sensitive. Use `"protected"` only when each principal should see a
permission-filtered catalogue. OAuth metadata remains public in both modes.

## Add Observability

The same factory accepts `observability`.

- Use `structuredLogging` for safe structured events.
- Use `openTelemetry` for traces and metrics.

Adapters receive only redacted framework events. They never receive request
bodies, arguments, results, tokens, provider claims, or raw errors. See the
[server API](https://github.com/emseepea/emseepea/tree/main/packages/framework#authentication-and-observability) for the complete configuration.

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

It does not include saved sessions, live progress, changes to data, or
production network setup. The protected-access test shows how to add an
application-supplied authentication adapter.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The endpoint is `http://127.0.0.1:3000/mcp` and the health check is
`http://127.0.0.1:3000/healthz`.

## Build a production container

Run `npm install` first so the project has a lockfile. Then run:

```sh
npm run container:build
```

The image is for a production deployment behind a trusted proxy. It starts with
the fail-closed production profile and needs a runtime-mounted deployment
configuration file. Keep secrets in your platform's runtime secret store, not in
the Dockerfile, build arguments, or deployment configuration file.

For the production proxy, runtime configuration, and hardening requirements, see
the [container guide](https://emseepea.github.io/emseepea/examples/#build-a-production-container).

## Add Feedback

Install `@emseepea/feedback` when this server needs a detailed one-way
observation or a durable support conversation. Pass its tools through the
application factory's `additionalTools` option. Choose PostgreSQL, Firestore,
GitHub Issues, or Zendesk in the [feedback guide](../../packages/feedback/README.md).

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

The semantic suite also checks that protected discovery offers the tool to a
permitted principal and does not offer it to a principal without permission.
Those two authorization cases assert native tool selection only, so they do not
pay for unrelated answer-meaning judgments.

If Claude is not already signed in, run `claude auth login` first.
