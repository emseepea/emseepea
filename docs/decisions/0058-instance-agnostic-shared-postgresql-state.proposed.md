---
status: "proposed"
date: 2026-09-08
human-oversight: confirmed
oversight-date: 2026-09-08
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-08
supersedes: ["ADR-0056"]
---

# Instance-Agnostic Shared PostgreSQL State

> Tom Howard chose the instance-agnostic shared-state design in this task on
> 2026-09-08.

## Context and Problem Statement

The multi-instance PostgreSQL example exposes server identity and a generic
idempotency key through its MCP tools. Those details make the user and model
reason about routing and storage mechanics that should remain invisible. The
example must instead show that interchangeable server processes provide one
coherent application experience through shared PostgreSQL state.

## Decision Drivers

- Keep users and models independent of server identity and routing.
- Use meaningful business identity instead of a caller-invented idempotency key.
- Make retries safe by saving complete desired state with one database upsert.
- Prove cross-process coherence without simulating routing in semantic tests.
- Keep the example small and avoid an ORM, lock service, or extra framework.

## Considered Options

1. **Instance-agnostic shared state**: expose save and get operations identified
   by garden bed and harvest date, while keeping process identity operational.
2. **Public instance and idempotency details**: retain the current request ID,
   creator-instance result, and instance-description tool.
3. **Stateless multi-instance example**: remove shared mutable state and show
   only identical stateless processes.

## Decision Outcome

Chosen option: **"Instance-agnostic shared state"**, because server identity and
retry mechanics are implementation details, while garden bed and harvest date
are stable concepts in the user's task.

The public MCP contract has exactly two tools: `save-harvest-report` and
`get-harvest-report`. A harvest report contains its garden bed, harvest date,
shelling count, snap count, and derived total. It contains no instance name,
request ID, idempotency key, or storage identifier.

PostgreSQL stores one complete desired report per garden bed and harvest date.
Those fields form the primary key. Save uses one `INSERT ... ON CONFLICT ... DO
UPDATE ... RETURNING` statement. Get selects by the same complete key and
returns an explicit null report when no row exists.

Instance labels may appear in process logs, inter-process test messages, and
test harness names. They do not enter the application factory, capability
context, tool schemas, descriptions, instructions, or responses.

## Consequences

### Good

- A user receives the same application state regardless of which process serves
  a request.
- Natural business fields define uniqueness and make retries safe.
- Saving complete desired state avoids patch semantics and partial updates.
- The public contract contains less implementation noise.

### Neutral

- PostgreSQL remains a required readiness dependency with one bounded pool per
  process.
- Cross-process behavior is proved by ordinary integration tests, not by asking
  a model to simulate routing.
- Process identity remains available to operators through logs and the test
  harness.

### Bad

- A client that wants to change one count must send the complete report state.
- The example does not demonstrate append-only events or exactly-once external
  effects.

## Confirmation

- Tool discovery lists only `save-harvest-report` and `get-harvest-report`.
- Public schemas and responses contain no instance, routing, request ID,
  idempotency, or storage ID fields.
- The table primary key is the garden bed and harvest date, with nonnegative
  count constraints.
- Ordinary tests save through one process, read through another, repeat an
  identical save, replace the complete desired state, and prove one row remains.
- Missing reports return an explicit null result rather than a provider failure.
- Tests preserve generic failure redaction, 503 readiness, and bounded database
  timeouts.
- Semantic tests use natural save and retrieve prompts with exact tool and
  argument assertions, without instance vocabulary or synthetic MCP hints.
- The standalone initializer, documentation, package metadata, and release
  checks describe interchangeable processes sharing coherent state.

## Pros and Cons of the Options

### Instance-Agnostic Shared State

- Good: Teaches the user-facing property that multi-instance deployments need.
- Bad: Does not expose infrastructure details for debugging through MCP.

### Public Instance and Idempotency Details

- Good: Makes storage and process behavior directly observable to the caller.
- Bad: Couples the MCP contract to routing and persistence mechanics.

### Stateless Multi-Instance Example

- Good: Has the smallest possible operational surface.
- Bad: Does not demonstrate coherent mutable state across processes.

## Reassessment Criteria

Reassess if a real application requires append-only effects, conditional
updates, or measured database behavior that complete-state upserts cannot meet.
Do not add public instance identity merely for operational diagnosis.
