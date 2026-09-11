# `@emseepea/create-resources-and-prompts-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template to publish readable resources, parameterized resource
addresses, reusable prompts, and prompt-field suggestions. Choose the
[tool server](../tool-server/README.md) when the model needs to call an
operation instead of reading material or rendering a prompt. [Compare all templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/resources-and-prompts-server -- my-server
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

## Resources and Prompts Example

Choose this example when you want to give an assistant reusable reference
content and guided starting questions, without adding another tool.

It provides:

- a fixed resource at one known address
- a resource pattern for related content at predictable addresses
- a reusable prompt with one checked argument
- optional suggestions for the resource and prompt fields

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port.

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
The [native AI behaviour test](eval/meaning.test.mjs) lives separately in
`eval/`. The commands below run each suite independently.

Run its build and MCP resource and prompt checks:

```sh
npm test
```

Check that Claude does not pretend an unselected resource was supplied:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.

Resources and prompts are selected through client features, not autonomously
called as tools. The ordinary tests qualify their MCP contracts. The AI test
checks only the honest experience before a user selects or attaches a resource;
it does not claim that the resource content was semantically qualified.
