# `@emseepea/create-multi-instance-postgres-server`

This directory is the maintained example and the candidate source for its
public npm initializer.

## Use This Template

Use this template when independently deployed server instances must share one
PostgreSQL-backed store and repeated request IDs must resolve to one stored
result. Choose the [tool server](../tool-server/README.md) when one process and
in-memory data are enough. [Compare all eight templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

Publication is pending exact Quality checks. After publication, use:

```sh
npm init @emseepea/multi-instance-postgres-server -- my-server
```

<!-- generated-project-readme -->

## Multi-Instance PostgreSQL Server

Choose this project when separate server instances may receive the same retry
and must avoid creating duplicate stored work.

Each server has its own Em See Pea app and PostgreSQL connection pool. The
servers coordinate through one shared database without sharing a local
filesystem.

The same request ID creates one stored pea harvest report. A retry through any
instance returns the original report, including the name of the instance that
created it.

## Run Locally

You need Node.js 22 or 24 and Docker Compose. Install dependencies, then start
PostgreSQL and both server instances with one run command:

```sh
npm install
npm run dev
```

The run command applies the database schema, starts two independent server
processes, and prints both MCP addresses. Stop them with Control-C. Remove the
database container and local volume when you no longer need them:

```sh
docker compose down --volumes
```

## Use Managed PostgreSQL

Set `DATABASE_URL` to a PostgreSQL connection string that every deployed
instance can reach. Apply the included schema once, then start each instance
with its own name:

```sh
npm run build
npm run db:setup
EMSEEPEA_INSTANCE=instance-a PORT=3000 npm run start:instance
```

Run the final command for each deployed instance, changing
`EMSEEPEA_INSTANCE` for each instance. Protect `DATABASE_URL` as a secret. Do
not put it in source control or send it to an MCP client.

## Tools

- `create-shared-harvest-report` atomically creates or returns one stored report
  for a request ID. The result identifies its original server instance.
- `describe-instance` returns the instance handling the current request and
  does not query PostgreSQL.

PostgreSQL enforces one report per request ID with a unique constraint. The
tool uses one atomic upsert, without an application-side existence check or a
distributed lock.

If PostgreSQL is unavailable, `/readyz` returns 503 and the report tool returns
a generic failure. Independent endpoints and `describe-instance` remain
available for diagnosis.

## Exact Scope

- Independently deployable server instances connected to one PostgreSQL database.
- One bounded connection pool per process.
- One atomic database statement per report request.
- PostgreSQL bounds database statements to 1.5 seconds. The driver cannot
  cancel an in-flight query from an AbortSignal, so the database timeout is the
  cancellation boundary.
- No claim that an external service change happens exactly once.
- No latency, throughput, or unlimited-scale claim.

## Check This Project

[Ordinary tests](test/) live in `test/`. The
[AI tool-choice and understanding test](eval/meaning.test.mjs) lives separately
in `eval/`. Docker Compose is required because both suites exercise real
PostgreSQL behavior.

Run the build and two-server MCP checks:

```sh
npm test
```

Check that Claude understands report replay correctly:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
