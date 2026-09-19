---
"@emseepea/server": minor
"@emseepea/create-api-backed-server": patch
"@emseepea/create-database-schema-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-multi-instance-postgres-server": patch
"@emseepea/create-openapi-backed-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-soap-backed-server": patch
"@emseepea/create-tool-server": patch
---

## What changed

Tool result schemas are now published open by default. An open schema allows
fields it does not list. A closed schema rejects them.

A tool result declared with `z.object` (Zod, the default schema library) now
publishes a schema that permits unknown fields. You can add a result field later
without breaking a client that validates against an older copy of that schema.

## Migration: re-capture your baselines once

This release needs one action from you. Upgrading alone is not enough.

After upgrading, the contract checker compares your new schemas against your
baselines and flags a break. Your baselines are the stored copies of the schemas
you published last time.

The break is named `output-additional-properties-changed`. It is reported once for
every object in an affected result schema, so a schema with nested objects reports
several breaks.

If your result schema uses `$defs` — the JSON Schema keyword for reusable
sub-schemas — the checker reports a second break at the same location, because it
cannot categorise a change inside a `$defs` entry. That break is named
`unclassified-schema-change`.

Both breaks are expected here. Re-capture your baselines once after upgrading, with
`emseepea-contract capture`. Both breaks then stop being reported. Reporting them
once is how the change stays visible rather than silent.

## How to keep a result schema closed

A declaration stays closed only if it closes both directions:

- input — what the caller may send
- output — what the tool returns

These stay closed. Nothing changes for them:

1. `z.strictObject`.
2. A hand-written JSON Schema that closes both directions.

One case now opens: a declaration that closes output only.

That case has one exception. To open the output, the framework pairs each object in
the input shape with an object in the output shape. If the two shapes differ too
much to pair, the schema stays closed.

## What did not change

Result values. A handler can still return only the keys its result schema declares,
and a response still carries only declared fields. The published schema states what
a client must tolerate; it does not widen what the server sends.

## For maintainers publishing this release

Publish every affected `create-*` package in the same release as the
`@emseepea/server` version it pins, so the whole set can be verified together.
