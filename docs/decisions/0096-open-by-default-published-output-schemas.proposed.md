---
status: "proposed"
date: 2026-09-19
human-oversight: confirmed
oversight-date: 2026-09-19
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2026-12-19
---

# Open-by-Default Published Output Schemas

**Status: proposed. What is being asked:** ratify the chosen option below, or
reject it. Ratifying commits the framework to publishing open output schemas by
default, and commits every adopter to one baseline re-capture at the upgrade.
Reassessment is due 2026-12-19.

## Context and Problem Statement

A tool declares the shape of its results with a schema. The framework converts
that declaration into a published JSON Schema — a document, written in
JavaScript Object Notation (JSON), that describes the fields a response may
contain. When a tool uses the ordinary object declaration from the schema
library Zod (`outputSchema: z.object({ ... })`), the published schema carries
`"additionalProperties": false`.

That published output schema is **closed**: a client validating a response
against it must reject any field it does not already know about.

Closed output schemas make every later additive field a breaking change for a
client holding a fixed, older copy of the schema. This is not hypothetical. This
decision responds to a report, raised from running the framework, that a tool's
published output schema closed its result object, so adding a field later would
break clients that hold a captured copy of the earlier schema.

A marketplace captures a server's tool list when the server is submitted for
listing. Clients then receive that captured copy. They do not ask the running
server for its current tool list (the `tools/list` call), so they never see
later changes. The server can be several versions ahead of the schema its
clients validate against, and an ordinary, well-intentioned new field breaks
them.

Declaring the same tool with `z.looseObject` publishes an **open** schema
instead — one that tells a client to accept fields the schema does not list.
Everything else is unchanged. This safer declaration already exists. It is not
the obvious one, and nothing prompts the author to consider it at the point
where the tool is defined. The consequence appears only once a **pinned client**
exists — a client validating against a fixed, older copy of the schema. That is
usually long after the tool was written.

Throughout this record, **published output schema** means the document the
framework publishes, and **output contract** means the obligation that document
places on a client.

Three further facts shape this decision.

First, the framework's own tooling already treats the closed default as a
liability. The framework includes a **comparator**: a tool that compares a
tool's currently published schema against a stored earlier copy, called the
**baseline**. When it finds an incompatible difference, it reports a **break**.
Adding a new output property raises the `output-field-added` break — but only
when the baseline schema was closed. With the ordinary declaration, the
framework therefore reports every additive output field as a breaking change
against its own comparator.

Second, closure is currently an accurate description of behaviour, not an
accident. Two things stop an undeclared field from being sent. First, a key the
output schema does not list is rejected where the tool is defined, before the
code compiles. Second, at runtime the framework sends the value the schema
produced, on both the convenience result form (a handler returning `data`) and
the protocol-native result form (a handler returning `structuredContent`). So an
undeclared field is never sent to a client. The published `false` is truthful
for any single version of a server. The harm is entirely cross-version.

Third, the input and output sides already disagree. The same declaration
publishes an open schema on the input side, because the schema library adds no
closure when converting for input, and a closed schema on the output side.

The question is whether a published output schema should describe what this
version of the server sends, or state what a client must tolerate.

## Decision Drivers

- Additive output fields are the normal way a useful tool evolves. Adding one
  should not require every pinned client to be updated first.
- JSON-based interfaces stay evolvable because clients ignore unknown fields
  instead of rejecting them. Earlier interface generations used Extensible
  Markup Language (XML) with XML Schema, which closed content by default. In
  those, adding one field broke every existing client. That history is the
  strongest argument against closing by default here.
- The safe choice must be the default. An opt-in alternative that nobody finds
  until a client has already broken is not a working safeguard.
- The framework should not report a routine additive change as breaking through
  its own comparator.
- Adopters — the teams building on this framework — currently choose their own
  comparison rules by opting in to a **check policy module**: an optional set of
  comparison rules an adopter enables for its own contracts. An earlier decision
  set that boundary deliberately. This decision must not reverse it without
  saying so.
- We must classify and migrate any change to an adopter's published output
  schema on purpose. We must never let such a change ship unannounced.

## Considered Options

1. **Open by default, opt in to closed** - Published output schemas permit
   unknown fields. A tool that genuinely needs a closed output contract declares
   it explicitly.
2. **Keep closed by default, make openness adopter-owned** - Leave publication
   unchanged. Document that tolerance for additive output fields is a policy
   choice, served by the existing opt-in check policy module or an explicit
   permissive declaration.
3. **Make output strictness an explicit authoring choice** - Remove the implicit
   default in both directions. Tool registration must state open or closed, and
   existing tools keep their current published output until migrated.
4. **Do nothing, and document the behaviour** - Treat the input and output
   difference as intended, record it in the adoption guide, and close the report
   as working as intended.

## Decision Outcome

Chosen option: **"Open by default, opt in to closed"**.

Two reasons. First, a published output schema states what a client must
tolerate. It does not describe what this version of the server sends. Second,
open content is the default that keeps JSON interfaces evolvable.

**A published output schema is a client validation contract.** Open content
means a client must not reject a response because it carries a field the client
does not recognise. It does not grant the server permission to send undeclared
fields.

**The author-side contract stays closed, and the difference is deliberate.** A
handler still cannot return a key absent from its output schema: that is
rejected where the tool is defined, and the sent value remains the one the
schema produced. The server continues to send exactly its declared fields. The
two boundaries answer different questions, so they are allowed to differ. This
decision records that difference as intended rather than accidental.

**The input and output sides are brought into agreement.** Both directions now
publish open schemas. The previous difference was an accidental side effect of
the conversion library's defaults, not a considered position. There is no reason
for the two sides to disagree.

**This decision adds to the opt-in check policy module decision. It replaces no
earlier decision.** That decision considered broadening the default validator
and comparator, and rejected it, so that unrelated adopters would not inherit
conflicting comparison rules
([ADR-0095](0095-opt-in-check-policy-modules-for-adopter-contracts.proposed.md)).
This decision does not touch the comparator. It changes what the framework
publishes. The reason: an open output contract is the right default for every
adopter, not a per-adopter preference. Adopters with genuinely closed output
contracts keep them by declaring them, and the policy-module boundary is left
intact for the comparison rules it governs.

**The one-time break is classified, not absorbed.** Changing a published output
schema from closed to open is itself a comparator break for anyone holding a
baseline. It is classified here as a deliberate, framework-version migration
boundary. Three things follow. The release notes state the break. Adopters
re-capture their baseline once, at the upgrade. The release is labelled a
migration, not a routine additive release.

**The `output-field-added` check stops firing for the default declaration.**
That check fires only when the baseline schema is closed. We accept this cost.
The check was reporting a routine added field as a break. Removing that report
is the reason this decision exists. Adopters who want additive output fields
reported keep the closed declaration and the policy-module route.

## Consequences

### Good — what this improves

- Adding an output field stops being a breaking change for clients pinned to an
  older published schema, including marketplace-served clients.
- The safe behaviour is what a developer gets without knowing to ask for it.
- The framework stops reporting routine additive output fields as breaking
  through its own comparator.
- Input and output publication agree with each other.

### Neutral — what this changes without cost

- Published output schemas describe what the client must accept, rather than
  what the server currently sends. Both are legitimate readings; this decision
  fixes which one applies.
- Adopters who want a closed output contract keep it, at the cost of stating it.

### Bad — what this costs

- Every adopter holding a baseline sees one comparator break at the upgrade and
  must re-capture.
- The `output-field-added` check stops firing for tools that use the default
  declaration, so a class of additive change is no longer reported
  automatically.
- A published output schema now says less about which fields a response will
  contain. A language model reading the response therefore relies more on each
  field's description.

## Confirmation

These checks confirm the change worked, once the decision is implemented. Each
must pass.

- Declare a tool with a plain object output schema. Check that the published
  schema's `additionalProperties` permits unknown fields.
- Check that the same tool's published input schema also permits unknown fields,
  so the two directions agree.
- Write a handler that returns a key the output schema does not list. Check that
  the framework rejects that key. Check that the response carries only declared
  fields.
- Declare a tool with an explicitly closed output contract. Check that it still
  publishes a closed schema.
- Compare a baseline captured before this change against the published output
  schema produced after it. Check that the closed-to-open change is reported,
  confirming it surfaces as a migration rather than passing unnoticed.
- Read the release notes for the implementing release. Check that they state the
  break and the re-capture step.

## Pros and Cons of the Options

### Open by default, opt in to closed

- Good: additive output fields stop breaking pinned clients without any action
  by the tool author.
- Good: the default matches the convention that keeps JSON interfaces
  evolvable.
- Good: removes a self-inflicted breaking-change report from the framework's own
  tooling.
- Bad: one-time comparator break and re-capture for every existing baseline.
- Bad: the `output-field-added` check stops firing for tools that use the
  default declaration.
- Bad: publishes a contract looser than what the server actually sends.

### Keep closed by default, make openness adopter-owned

- Good: no break, no migration, and no check stops firing.
- Good: consistent with leaving comparison rules to each adopter.
- Bad: leaves the friction with every adopter who has not yet hit it.
- Bad: the safer declaration stays non-obvious, so the problem recurs for each
  new tool author.

### Make output strictness an explicit authoring choice

- Good: no silent change of contract in either direction.
- Good: the choice becomes visible exactly where it is made.
- Bad: a type-level breaking change for every tool author, and the largest
  migration of the four.
- Bad: adds required ceremony to defining a tool, which works against keeping
  the starting point small.

### Do nothing, and document the behaviour

- Good: zero break and zero migration.
- Bad: does not address the report. The next adopter meets the same surprise
  after a pinned client already exists.

## Reassessment Criteria

Revisit this decision if any of the following hold.

- The schema library Zod changes its output-side default, making the
  framework's published behaviour depend on a library default again.
- The Model Context Protocol specification states a required position on output
  schema strictness.
- We find that adopters rely on closed published output schemas to drive client
  behaviour, not only to validate responses.
- The `output-field-added` check no longer firing for the default declaration is
  shown to let a genuinely incompatible output change reach adopters unreported.
