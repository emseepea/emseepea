# `@emseepea/create-react-ui-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template for an accessible form in an application that already uses
React. Choose the [HTML UI server](../html-ui-server/README.md) when native HTML
is enough and you want fewer front-end dependencies. [Compare all templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/react-ui-server -- my-server
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

## React and Tailwind UI Example

Choose this example when your application already uses React and you want an
accessible form without writing Tailwind configuration or component styles.

This example makes the server-rendered form interactive with React and imports
one compiled Em See Pea stylesheet. It needs no Tailwind configuration and uses
the same sample states as the native example.

`src/server.tsx` assembles the server. HTTP handlers live in `src/routes/`,
where the filename supplies the method and path. The route files serve the page,
form response, stylesheet, and browser script. Add a direct Fastify route only
when a handler does not fit this simple file convention.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

Open
`http://127.0.0.1:3001/` for the page or use
`http://127.0.0.1:3001/mcp` for Model Context Protocol (MCP).

The MCP endpoint also publishes an opt-in MCP Apps result card for the preview
tool. See the [UI example guide](https://emseepea.github.io/emseepea/examples/#add-a-web-form-or-mcp-app)
for the resource contract and ChatGPT compatibility fields.

The result card maps the tool's domain output into the shared bounded result
model, renders it with `ResultCard`, and uses `useMcpApp` for the MCP Apps host
lifecycle. The example keeps only its domain parser, mapping, and action text.

The page previews a sample pea planting plan only. It does not send or store a report.

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

Run its build, browser, keyboard, React, and accessibility checks:

```sh
npm test
```

Check that Claude chooses the preview tool and understands that it changes nothing:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
