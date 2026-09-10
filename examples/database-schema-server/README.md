# `@emseepea/create-database-schema-server`

This directory is both the maintained example and the template source for its
public npm initializer.

## Use This Template

Use this template when PostgreSQL already defines the internal data contract
and you want generated TypeScript and runtime validation to follow it. It shows
reads and writes through a view, with one stored procedure as a secondary
integration example.

Choose the [API-backed server](../api-backed-server/README.md) for an HTTP API,
or the [multi-instance PostgreSQL server](../multi-instance-postgres-server/README.md)
when shared state across interchangeable processes is the main lesson.
[Compare all templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/database-schema-server -- my-server
```

The command creates a standalone app in a new `my-server` directory and sets
`private: true` in its `package.json` so the app cannot be published by
accident. It includes the database schema, checked-in generated code, Docker
Compose setup, lint checks, ordinary tests, and semantic tests.

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

## Database Schema Server

PostgreSQL is authoritative for the internal contract. Kanel and Kanel Zod
generate TypeScript and runtime validators from the committed schema. Normal
builds and starts use the checked-in generated files, so they do not need a
live database.

The MCP schemas are small, public, and described for an AI. Database rows are
validated with generated schemas at the integration boundary. New compatible
database values, such as a new pea type, pass through without an application
release.

## Run Locally

You need Node.js 22 or 24 and Docker Compose.

```sh
npm install
npm run dev
```

Stop the server with Control-C. Remove the local database and volume when you
no longer need them:

```sh
docker compose down --volumes
```

## Change the Database Contract

Edit `schema.sql`, recreate the development database, then regenerate the
checked-in files:

```sh
docker compose down --volumes
docker compose up --detach --wait database
npm run generate
```

Review the generated diff before committing it. CI recreates PostgreSQL from
`schema.sql`, regenerates the files, and fails if they differ.

Views are the preferred application boundary because they support ordinary
reads and writes while insulating tools from storage tables. The
`summarize-pea-catalog` procedure is included only for databases where an
existing operation must remain procedural.

## Tools

- `list-pea-varieties` reads a bounded, fixed projection from the catalogue view.
- `add-pea-variety` writes through the updatable catalogue view.
- `summarize-pea-catalog` calls the secondary stored procedure.

The tools never accept SQL, operators, table names, sort expressions, or
destinations from the caller. PostgreSQL statements have a 1.5 second timeout,
the connection pool is bounded, and provider failures return a generic error.

## Add Feedback

Install `@emseepea/feedback` when this server needs a detailed one-way
observation or a durable support conversation. Pass its tools through the
application factory's `additionalTools` option. Choose PostgreSQL, Firestore,
GitHub Issues, or Zendesk in the [feedback guide](../../packages/feedback/README.md).

## Check This Project

Run generation, lint, build, and ordinary integration tests without spending
model tokens:

```sh
npm run generate:check
npm run lint
npm test
```

Run the more expensive AI test separately:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
