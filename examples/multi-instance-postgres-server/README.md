# `@emseepea/create-multi-instance-postgres-server`

This directory is both the maintained example and the template source for its
public npm initializer.

## Use This Template

Use this template when independently deployed server processes must present one
coherent PostgreSQL-backed application state. It demonstrates interchangeable,
stateless MCP processes without exposing server identity or routing to users.

Choose the [tool server](../tool-server/README.md) when one process and in-memory
data are enough. [Compare all eight templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/multi-instance-postgres-server -- my-server
```

The command creates a standalone app in a new `my-server` directory and sets
`private: true` in its `package.json` so the app cannot be published by
accident. It includes its PostgreSQL schema, Docker Compose setup, lint checks,
ordinary tests, and semantic tests.

<!-- generated-project-readme -->

## Multi-Instance PostgreSQL Server

Each server process owns its own Em See Pea app and bounded PostgreSQL
connection pool. Every process reads and writes the same application state, so
a client does not need sticky sessions or knowledge of which process served a
request.

The example stores one complete pea harvest report per garden bed and harvest
date. PostgreSQL enforces that meaningful business key. Saving the same report
again is safe, and saving changed counts replaces the complete desired state.

## Run Locally

You need Node.js 22 or 24 and Docker Compose. Install dependencies, then start
PostgreSQL and two independent server processes:

```sh
npm install
npm run dev
```

The command applies the database schema and prints both MCP addresses. Stop it
with Control-C. Remove the database container and local volume when you no
longer need them:

```sh
docker compose down --volumes
```

## Use Managed PostgreSQL

Set `DATABASE_URL` to a PostgreSQL connection string that every deployed
process can reach. Apply the included schema once, then start each process:

```sh
npm run build
npm run db:setup
PORT=3000 npm run start:instance
```

Use a different port or deployment endpoint for each process. You may set
`EMSEEPEA_INSTANCE` to add an operator-friendly label to logs. That label never
enters the MCP tool contract. Protect `DATABASE_URL` as a secret. Do not put it
in source control or send it to an MCP client.

## Tools

- `save-harvest-report` saves the complete report for one garden bed and
  harvest date.
- `get-harvest-report` retrieves that report, or returns `null` when it does not
  exist.

If PostgreSQL is unavailable, `/readyz` returns 503 and both tools return a
generic failure without connection details. Another healthy process connected
to the shared database continues to serve the same state.

## Exact Scope

- Independently deployable server processes connected to one PostgreSQL database.
- One bounded connection pool per process.
- One database statement per tool call.
- PostgreSQL bounds statements to 1.5 seconds. The driver cannot cancel an
  in-flight query from an AbortSignal, so the database timeout is the
  cancellation boundary.
- No sticky-session requirement.
- No claim of exactly-once external effects, latency, throughput, or unlimited
  scale.

## Check This Project

[Ordinary tests](test/) prove cross-process state, complete-state replacement,
missing reports, provider failure, readiness, and bounded queries. The
[semantic test](eval/meaning.test.mjs) checks that an AI naturally selects the
save and get tools with the right arguments.

Run the build and two-process MCP checks:

```sh
npm test
```

Run the more expensive AI test separately:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
