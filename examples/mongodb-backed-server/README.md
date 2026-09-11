# `@emseepea/create-mongodb-backed-server`

This directory is both the maintained example and the template source for its
public npm initializer.

## Use This Template

Use this template when MongoDB stores the data and your collections use either
database-enforced schemas or schemaless storage. It shows both approaches in
one project, using the official driver directly without an object-document
mapper.

Choose the [database-schema server](../database-schema-server/README.md) when
PostgreSQL is authoritative, or the [API-backed server](../api-backed-server/README.md)
for an HTTP service. [Compare all templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/mongodb-backed-server -- my-server
```

The command creates a standalone app in a new `my-server` directory and sets
`private: true` in its `package.json` so the app cannot be published by
accident. It includes Docker Compose, lint checks, ordinary tests, and semantic
tests.

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

## MongoDB-Backed Server

`pea_varieties` is schema-enforced. `src/pea-document.ts` contains its only
stored-document schema. MongoDB applies that exact object as its collection
validator, Ajv checks data in the application, and `FromSchema` infers its
TypeScript type.

`pea_observations` is intentionally schemaless in MongoDB.
`src/pea-observation-document.ts` contains its only application schema. Ajv
validates every observation before a write and after a read, while `FromSchema`
infers its TypeScript type. This protects the MCP boundary without pretending
that MongoDB will reject writes made outside the application.

Choose the approach collection by collection. Do not copy either JSON Schema
into a TypeScript interface or a second field validator.

The public MCP schemas remain small and described for an AI. A compatible new
string value, such as another pea type, passes through without a translation
map or application release. MongoDB `_id` values stay internal.

## Run Locally

You need Node.js 22 or 24 and Docker Compose.

```sh
npm install
npm run dev
```

Stop the server with Control-C. Remove the local database and volume when you
no longer need them:

```sh
npm run db:reset
```

`npm run db:reset` deletes the local MongoDB volume and its data. You cannot
undo this action. Docker Compose starts MongoDB for local development only. It
is not a production deployment recipe.

For a managed MongoDB deployment, set `MONGODB_URL`, build, apply the collection
schema once, then start the server:

```sh
npm run build
npm run db:setup
npm start
```

Use the database name in the connection URL, such as
`mongodb://127.0.0.1:27017/emseepea`. When it is omitted, the example uses
`emseepea`.

Protect `MONGODB_URL` as a secret. Do not put it in source control or send it to
an MCP client.

## Build a production container

Run `npm install` first so the project has a lockfile. Then run:

```sh
npm run container:build
```

The image is for a production deployment behind a trusted proxy. It starts with
the fail-closed production profile and needs a runtime-mounted deployment
configuration file. Keep secrets, including `MONGODB_URL`, in your platform's
runtime secret store, not in the Dockerfile, build arguments, or deployment
configuration file.

For the production proxy, runtime configuration, and hardening requirements, see
the [container guide](https://emseepea.github.io/emseepea/examples/#build-a-production-container).

## Tools

- `add-pea-variety` validates and inserts one document.
- `list-pea-varieties` reads a fixed projection of at most 20 varieties.
- `record-pea-observation` validates and records one dated observation.
- `list-pea-observations` reads a fixed projection of at most 20 observations.

The tools never accept database operators, collection names, sort documents,
or destinations. The pool and database operations are bounded, and provider
failures return a generic error.

## Add Feedback

Install `@emseepea/feedback` when this server needs a detailed one-way
observation or a durable support conversation. Pass its tools through the
application factory's `additionalTools` option. Choose PostgreSQL, Firestore,
GitHub Issues, or Zendesk in the [feedback guide](../../packages/feedback/README.md).

## Check This Project

Run lint, build, and ordinary database integration tests without spending model
tokens:

```sh
npm run lint
npm test
```

Run the more expensive AI test separately:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
