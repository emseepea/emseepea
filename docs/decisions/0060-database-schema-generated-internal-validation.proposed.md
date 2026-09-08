---
status: "proposed"
date: 2026-09-08
human-oversight: confirmed
oversight-date: 2026-09-08
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-08
---

# Database Schema Generated Internal Validation

## Context and Problem Statement

The examples need to show how an MCP server can use an existing SQL database
without hand-writing a second internal model that can drift from the database.
The example must teach a transferable database-to-internal-schema pattern while
using one concrete database and generator that can be run and tested.

## Decision Drivers

- Make the database schema the source of internal TypeScript types and runtime
  validation.
- Prefer stable views for reads and writes so table changes do not automatically
  change the MCP integration.
- Include one stored procedure to show the alternative, while documenting views
  as the normal path.
- Keep the public MCP schemas separate, described, and deliberately bounded.
- Avoid an ORM, repository layer, or project-owned generator.

## Considered Options

1. **PostgreSQL catalog with Kanel and Kanel Zod**: generate internal TypeScript
   types and Zod schemas from PostgreSQL views and named composite types used by
   procedures.
2. **Application schema as source**: define an ORM or validation schema in
   TypeScript and generate the database shape from application code.
3. **Hand-written internal schemas**: maintain TypeScript and Zod declarations
   beside SQL definitions.

## Decision Outcome

Chosen option: **"PostgreSQL catalog with Kanel and Kanel Zod"**, because it
starts from the database contract the example is meant to integrate and uses an
existing generator rather than adding project-owned code generation.

The public package is `@emseepea/create-database-schema-server`, maintained in
`examples/database-schema-server`. PostgreSQL is the concrete implementation;
the example claims that its schema-first pattern is transferable, not that its
driver supports every SQL database.

One read tool selects a fixed projection from a documented view. One write tool
writes through an updatable view. One secondary tool calls a stored procedure
that returns a named composite type already represented by a generated schema.
Kanel 4 with Kanel Zod 4 generates internal types and validators from the live
PostgreSQL catalog during the explicit generation step. Generated files are
checked in so ordinary builds and installs do not require a live database.

Public MCP input and output schemas remain hand-authored Zod schemas with useful
property descriptions. They select what the model may send and receive. The
generated internal schemas validate values at the database boundary.

The example uses a bounded connection pool, a statement timeout, fixed
projections, and bounded result counts. Failures are generic at the public
boundary. Connection strings, credentials, and environment-specific catalog
details do not enter generated files, responses, or logs.

The provisional per-call budget is 1 to 5 milliseconds of process CPU, at most
1 MiB of transient application memory, and 2 to 32 KiB of network traffic,
assuming at most 1,000 calls per day. Qualification measures these paths before
release and records whether they remain within 1 to 5 CPU-seconds and 2 to 32
MiB of daily traffic at that assumed volume.

## Consequences

### Good

- Database changes become visible as generated-code changes and type-checking
  failures.
- Views provide a stable integration boundary without a repository abstraction.
- The stored-procedure comparison is concrete without presenting procedures as
  the preferred default.

### Neutral

- PostgreSQL is used to demonstrate a transferable pattern.
- Regeneration requires a reachable development database.

### Bad

- Kanel and Kanel Zod add development dependencies.
- Generated files must be regenerated and reviewed when the database contract
  changes.

## Confirmation

- The initializer creates a private standalone project containing its SQL,
  generation configuration, generated types and validators, and documented
  regeneration command.
- CI creates PostgreSQL from committed SQL, regenerates files, requires a clean
  diff, compiles the result, and runs database-boundary validation.
- Changing a view shape changes generated TypeScript and Zod output.
- Generated files contain no credentials, connection strings, or
  environment-specific catalog details.
- Ordinary tests cover read-through-view, write-through-view, stored-procedure,
  bounded results, invalid database output, statement timeout, unavailable
  database, generic errors, and absence of `DATABASE_URL` from output and logs.
- Semantic tests use the natural MCP journey and demonstrate the view-backed
  tools with the minimum model calls needed for useful coverage.
- The package passes the existing standalone, release, provenance, registry,
  accessibility, and documentation gates.
- The README and package description say PostgreSQL demonstrates a transferable
  pattern and do not claim multi-database runtime support.
- Measured process CPU, memory, and network evidence is recorded before release.

## Pros and Cons of the Options

### PostgreSQL Catalog with Kanel and Kanel Zod

- Good: The database is the source of internal types and runtime schemas.
- Bad: The concrete tooling is PostgreSQL-specific.

### Application Schema as Source

- Good: Application types and migrations can share one code definition.
- Bad: It demonstrates application-first design rather than the requested
  database-to-internal-schema integration.

### Hand-Written Internal Schemas

- Good: It adds no generator dependencies.
- Bad: SQL, TypeScript, and runtime validators can drift independently.

## Reassessment Criteria

Reassess if Kanel cannot represent the chosen views or procedure result, clean
generation is not deterministic, or another maintained generator provides the
same database-first guarantees with fewer dependencies.
