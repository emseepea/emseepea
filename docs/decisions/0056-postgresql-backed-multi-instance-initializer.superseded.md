---
status: "proposed"
date: 2026-09-07
human-oversight: confirmed
oversight-date: 2026-09-07
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-07
supersedes: ["ADR-0051"]
---

# PostgreSQL-Backed Multi-Instance Initializer

> Tom Howard supported replacing the host-bound SQLite example with the
> PostgreSQL design described in this decision on 2026-09-07.

## Context and Problem Statement

The multi-instance SQLite example coordinates two server processes through one
file on one computer. Its name suggests horizontally scalable coordination,
but the design cannot coordinate instances on different computers, containers,
or serverless workers. That mismatch teaches an unsafe boundary for the exact
deployment problem the example claims to address.

The maintained example and public initializer must demonstrate multi-instance
coordination through shared infrastructure that independently deployed server
instances can reach.

## Decision Drivers

- Demonstrate a design that remains valid across computers and containers.
- Make duplicate prevention a database invariant, not a process convention.
- Keep one maintained example as the initializer template source.
- Preserve a direct local development journey.
- Avoid an ORM, migration framework, distributed lock, or generator framework.
- Keep release, provenance, accessibility, semantic, and registry checks intact.

## Considered Options

1. **Replace SQLite with PostgreSQL**: publish a new PostgreSQL initializer,
   run PostgreSQL locally with Docker Compose, and use the same `DATABASE_URL`
   contract with managed PostgreSQL.
2. **Keep SQLite and narrow the name**: describe the example as two processes
   on one host rather than as a generally multi-instance design.
3. **Remove the multi-instance example**: stop teaching shared-state
   coordination in the maintained examples.

## Decision Outcome

Chosen option: **"Replace SQLite with PostgreSQL"**, because a multi-instance
example must preserve its coordination guarantees when instances run on
different computers.

The active package is `@emseepea/create-multi-instance-postgres-server`. Its
maintained source lives in `examples/multi-instance-postgres-server`. The old
SQLite creator is deprecated after replacement verification, then the release
operator removes it from npm when npm permits. It is not retained in the active
package list.

Each server process owns one bounded `pg` connection pool and connects through
`DATABASE_URL`. PostgreSQL is a required readiness dependency. An unavailable
database makes `/readyz` return 503 before dependent work is accepted, while
tool failures remain generic and expose neither connection details nor provider
errors.

The database owns idempotency through a unique constraint. Report creation uses
one atomic `INSERT ... ON CONFLICT ... RETURNING` statement. There is no
application-side check before insertion and no distributed lock.

The example owns one SQL schema file. Docker Compose provides PostgreSQL 18.6
on Alpine 3.23 for local development. The Node client is the MIT-licensed `pg`
8.23.0 package. Normal dependency maintenance may update these pinned versions
without changing this decision.

Docker Compose starts PostgreSQL for the primary local journey. `npm start`
starts two independent server processes that connect to it over TCP. The same
application connects to a separately managed PostgreSQL service by setting
`DATABASE_URL`.

All public packages continue to use npm's `latest` channel. There remain eight
active initializer packages, one maintained template source per initializer,
and one canonical package list for build, release, and registry verification.

## Consequences

### Good

- Independently deployed server instances coordinate through shared state.
- A database constraint and atomic statement prevent duplicate report rows.
- Local and deployed environments use the same connection contract.
- The example demonstrates a portable production boundary rather than a
  host-local shortcut.

### Neutral

- PostgreSQL is application infrastructure, not an Em See Pea framework
  dependency.
- The example claims correctness and cross-machine coordination, not a latency
  or throughput target.
- Historical release records continue to name the old SQLite package.

### Bad

- Running the example locally requires Docker Compose or another reachable
  PostgreSQL service.
- The replacement begins as a new npm package identity with new version
  history.
- The old creator must be deprecated after replacement verification, then
  removed by an explicit release action when npm permits.

## Confirmation

- The active package list contains exactly eight initializers and replaces the
  SQLite entry with `@emseepea/create-multi-instance-postgres-server`.
- The new initializer creates a private standalone project from its maintained
  example directory and includes its Compose and SQL files.
- Docker Compose starts PostgreSQL, and `npm start` starts two independent
  server processes that connect over TCP through `DATABASE_URL`.
- A test races the same request through both instances and proves one stored
  row, identical report results, and replay through the other instance.
- Tests prove database unavailability produces `/readyz` 503, generic tool
  failure, no connection-detail disclosure, and no duplicate effect.
- The example does not claim exactly-once external side effects, latency, or
  throughput.
- The old creator is removed from npm, or deprecated with a pointer to the
  PostgreSQL initializer when npm refuses removal.
- Root guidance, example guidance, the documentation website, semantic tests,
  package metadata, and release checks use the new name and honest scope.
- The new package passes pack, standalone install, lint, ordinary tests,
  semantic smoke tests, provenance, software-bill-of-materials, registry
  readback, and clean-install verification.

## Pros and Cons of the Options

### Replace SQLite with PostgreSQL

- Good: Demonstrates real horizontal coordination with familiar infrastructure.
- Bad: Adds a database service and one small client dependency to the example.

### Keep SQLite and Narrow the Name

- Good: Retains a lightweight, built-in local example.
- Bad: Does not teach the cross-machine problem users expect from
  "multi-instance".

### Remove the Multi-Instance Example

- Good: Avoids an infrastructure dependency and any misleading claim.
- Bad: Leaves no maintained example of shared idempotency across server
  instances.

## Reassessment Criteria

Reassess if PostgreSQL no longer supports the required atomic operation, Docker
Compose no longer provides a practical local journey, a smaller portable shared
store can provide the same guarantees, or the example cannot remain within the
project's qualification and release budgets.
