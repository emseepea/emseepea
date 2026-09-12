---
status: "proposed"
date: 2026-09-12
human-oversight: confirmed
oversight-date: 2026-09-12
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-12
---

# Checked Protocol-Native Tool Results

## Context and Problem Statement

MCP 2026-07-28 permits `tools/call` results to contain all five standard
content-block variants, optional structured content of any JSON shape, an
application error indicator, and result metadata. A tool's `outputSchema` is
optional. When it is present, successful structured content must conform to it.

Em See Pea currently requires an object-shaped `outputSchema`, validates each
tool's object-shaped `data`, and returns one generated or application-supplied
text block. This convenience contract excludes valid content-only results,
deliberate domain errors, result metadata, and array, scalar, or null structured
content. Requiring applications to compromise those results or bypass Em See
Pea would make the framework less interoperable than the protocol.

This decision determines how to admit the complete protocol-native result
envelope without weakening Em See Pea's checked boundary or breaking existing
applications.

## Decision Drivers

- Accept the complete MCP 2026-07-28 `CallToolResult` contract.
- Preserve the existing `{ data, text? }` convenience contract where it is checked by an output schema.
- Keep protocol ownership, validation, copying, freezing, and size limits in the framework.
- Support optional `outputSchema` and every JSON-valid structured-content shape.
- Preserve generic redaction for framework failures while allowing deliberate domain errors.
- Keep direct, mapped, and streaming tools on the shared execution path.
- Prevent result metadata from spoofing framework or server identity.
- Avoid unrelated retries, replay, persistence, reconnect, sampling, catalogue mutation, or notifications.

## Considered Options

1. **Checked protocol-native results plus structured convenience (chosen)**: accept a fully checked MCP `CallToolResult` or the existing checked `{ data, text? }` convenience form.
2. **Structured convenience with rich content**: add content blocks but continue requiring object-shaped `data` and `outputSchema` for every result.
3. **Unchecked raw protocol results**: pass handler-returned MCP results directly to the client.

## Decision Outcome

Chosen option: **"Checked protocol-native results plus structured convenience"**,
because it preserves Em See Pea's safe framework boundary without narrowing the
responses that protocol-compliant applications can return.

Handlers may return one of two distinct forms:

- The existing convenience form, `{ data, text? }`, when the tool declares an
  `outputSchema`. The framework validates `data`, emits it as
  `structuredContent`, and preserves the current explicit-text or generated-text
  behavior.
- A protocol-native `CallToolResult`. The framework validates the entire result
  with the installed MCP SDK schema, then applies the checks below before
  emitting it.

The forms must not be mixed. A result containing convenience fields and
protocol-native fields is malformed. Without an `outputSchema`, the convenience
form is unavailable because its `data` would be unchecked.

`outputSchema` becomes optional. For a successful protocol-native result with
an `outputSchema`, `structuredContent` is required and must conform to that
schema. For `isError: true`, structured content remains optional because the MCP
SDK deliberately does not apply output-schema validation to error results.
Without an `outputSchema`, a handler may return content-only or error results,
or include any JSON-valid `structuredContent`, including objects, arrays,
strings, numbers, booleans, and null.

Every accepted result is checked for safe JSON values, bounded by the existing
whole-result byte limit, copied, validated, and frozen before emission. Safe JSON
continues to exclude non-finite numbers, non-plain objects, sparse arrays,
cycles, and other values that cannot be represented reliably. The five accepted
content blocks are text, image, audio, resource link, and embedded resource.

Handlers may set `isError: true` for deliberate domain failures. Thrown
exceptions, malformed results, schema failures, cancellation, and deadline
expiry still produce the framework's generic redacted error instead of exposing
application or framework details.

Result `_meta` is client-visible application data. It receives the same safe
JSON and size checks and must not contain credentials or data the client is not
authorized to receive. Framework-owned and SDK-owned metadata keys, including
`io.modelcontextprotocol/serverInfo`, are rejected so a handler cannot spoof
server identity. The framework does not expose JSON-RPC, HTTP, destination,
credential, or transport control through the result contract.

Resource links and embedded resources are presentation payloads only. They do
not register a resource, authorize access, or cause server-side dereferencing.
The shared checked path applies the same contract to direct, mapped, and
streaming tools. Existing deadline, cancellation, progress-finalization,
safe-error, and whole-result byte limits remain in force.

## Consequences

### Good

- Applications can return every protocol-valid MCP tool result without leaving the checked framework path.
- Existing structured convenience handlers remain source compatible.
- Output-schema validation remains authoritative when a successful result declares structured output.
- Deliberate domain errors can reach clients without exposing thrown exceptions or framework failures.
- One installed SDK schema remains the authority for protocol result shapes.

### Neutral

- Tools may choose a convenience or protocol-native result form, but cannot mix them.
- Rich content and metadata remain bounded by the existing whole-result size limit.
- Resource links and embedded resources carry client-facing data but no framework authority.
- Input schemas remain object-shaped; only output schemas broaden to JSON-valued Standard Schemas.

### Bad

- Protocol-native results add validation, copying, and freezing work before serialization.
- Application authors must distinguish deliberate `isError` results from thrown failures.
- Client-visible `_meta` adds a disclosure surface that applications must review.
- Array, scalar, and null output schemas broaden the public type and qualification surface.

## Confirmation

- Type checks accept the existing `{ data, text? }` result only when an `outputSchema` is declared.
- Type checks accept protocol-native results with all five content-block variants, `isError`, `_meta`, and every JSON-valid structured-content shape.
- Type and runtime checks reject mixed convenience and protocol-native forms.
- Successful protocol-native results with an `outputSchema` require conforming `structuredContent`.
- Error results with `isError: true` do not require structured content, even when an output schema exists.
- Tools without an `outputSchema` can return content-only, deliberate-error, and safely checked structured results.
- Unsafe JSON, malformed blocks, unknown framework-owned metadata, and oversized results produce the existing generic safe tool error with no partial result.
- Application `isError: true` reaches the client, while thrown exceptions, cancellation, and deadlines retain generic redaction.
- Resource links and embedded resources grant no registration, dereference, or authorization authority.
- Direct, mapped, and streaming tools use the same checked result path.
- Existing convenience handlers preserve their explicit-text and generated-text behavior.
- Modern and legacy protocol journeys preserve their documented behavior.
- Packed-package and released-package journeys exercise both result forms.
- Registry readback verifies the released package and public types separately from source and CI evidence.

## Pros and Cons of the Options

### Checked Protocol-Native Results Plus Structured Convenience

- Good, because it admits the protocol's full result contract without bypassing framework checks.
- Good, because existing handlers do not need to migrate.
- Bad, because two explicit result forms require a discriminated public type and qualification.

### Structured Convenience with Rich Content

- Good, because it is a smaller change to the current public contract.
- Bad, because applications needing content-only results, deliberate domain errors, metadata, or non-object structured content must compromise or use another server framework.

### Unchecked Raw Protocol Results

- Good, because it requires little framework transformation.
- Bad, because it bypasses Em See Pea's validation, immutability, safe-error, and metadata-ownership boundaries.

## Performance Review

Source: **no data - worst-case planning assumptions only**.

At the existing one-mebibyte result ceiling, validation, copying, and freezing
may add up to 5 ms CPU and 4 MiB transient allocation per request while
admitting up to 1 MiB of application-selected network payload. At ADR-0014's
100 requests-per-second qualification floor, the planning ceiling is 500 ms
CPU, 400 MiB transient allocation, and 100 MiB application payload per second.
These are qualification inputs, not performance claims.

The pinned benchmark must still deliver at least 100 requests per second, at
most 5 ms p95 total framework CPU, at most 256 KiB p95 transient framework
allocation, and at most 2 KiB average framework-added network overhead. The
increment must not be released if the measured result exceeds those budgets.
Streaming tool results remain outside that budget, so this decision makes no
streaming performance claim.

## Reassessment Criteria

Reassess if the protocol changes `CallToolResult`, the installed SDK cannot
enforce the required result boundary, measured validation cannot meet the JSON
boundary budget without weakening safety, or a framework-owned metadata key
must become application-settable. Any reassessment must preserve checked
application output, generic framework-error redaction, cancellation, and an
explicit whole-result size limit.
