# Problem 006: A Strict Result Schema Opens When It Is Piped From an Open Object

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 9 (Medium) — Impact: 3 × Likelihood: 3 — see the rating note below
**Effort**: S (small) — a narrower pairing rule plus one regression case
**JTBD**: JTBD-006 — a job to be done: evolve a published contract safely
**Persona**: mcp-server-developer

## Description

Result schemas are published open by default as of `@emseepea/server@0.15.0`. A
declaration that closes both directions keeps its closed contract. One case
escapes that rule.

When an author writes a strict result schema that is fed from an open object —
for example an open object piped into a strict one — the framework compares the
two directions node by node. The matching input node is an object node, and it
is open. The rule therefore treats the closure as one the author applied to the
output direction alone, and drops it. The published schema says unknown fields
are permitted, when the author asked for them to be rejected.

The narrower rule the framework already applies covers the case where the
counterpart is a different kind of node, such as a string. That case keeps its
closure. This one does not, because the counterpart is the same kind of node and
is open.

## Symptoms

A result schema declared strict publishes without `"additionalProperties":
false` when its input counterpart is an open object node. A client reading the
published schema is told to tolerate fields the server will never send, and the
author's declared intent is not visible in the published contract.

## Workaround

Declare the result schema strict without piping it from an open object, so both
directions close. Check the published schema if the declaration is unusual.

## Rating note

Impact is 3. The published contract misdescribes the author's declared intent,
which is misleading metadata. It creates no security failure: runtime behaviour
is unaffected, the author-side gates still reject an undeclared key, and a
response still carries only declared fields. The error is in the permissive
direction, so a client following the published schema accepts a field the server
does not send, rather than rejecting one it does.

Likelihood is 3. It needs a deliberately strict result schema combined with a
transform or pipe from an open object, which is an uncommon shape. It is not
rare enough to discount: strict declarations are the documented way to ask for a
closed contract, so an author who cares about closure is the one most likely to
write this.

## Impact Assessment

- **Who is affected**: developers who deliberately declare a closed result
  contract and combine it with a transform.
- **Frequency**: (deferred to investigation)
- **Severity**: see the rating note above.
- **Analytics**: (deferred to investigation)

## Root Cause Analysis

The rule compares each output node against the input node at the same position
and drops a closure only when the counterpart is an object node that stays open.
That test cannot distinguish two different situations, because both present an
open object counterpart:

1. An ordinary object declaration, where the schema library closes the output
   direction alone. The closure should be dropped.
2. A strict declaration fed from an open object, where the author closed the
   output direction deliberately. The closure should be kept.

The published document does not record which of the two produced it. The rule
resolves the ambiguity toward opening, which is wrong for the second case.

This was disclosed rather than hidden: ADR-0096 records the pairing rule, and
the release note states that where the two shapes cannot be paired the schema
stays closed. This ticket exists because the readiness record that first
described the defect is overwritten at every release, so the disclosure needed a
home that outlives it.

### Investigation Tasks

- [ ] Create reproduction test
- [ ] Decide whether the author's declared strictness can be read from the
      schema rather than inferred from the converted documents, which would
      remove the ambiguity instead of narrowing it
- [ ] Decide whether an unpairable node should keep its closure and also report,
      so the author learns the published contract differs from the declaration

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

Arises from ADR-0096, which publishes result schemas open by default. That
record accepts a separate cost in the same area: the additive-output-field check
stops reporting for result schemas using the default declaration.

Captured via /wr-itil:capture-problem; expand at next investigation.
