---
status: "proposed"
date: 2026-09-12
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-12
---

# Checked MCP Content Blocks for Tool Results

> Captured via /wr-architect:capture-adr (foreground-lightweight aside-invocation per ADR-032, derived-substance amendment 2026-07-06 / RFC-045). Section content was derived by the capturing agent from the in-session decision context; human-oversight: pending until ratified at the /wr-architect:review-decisions drain.

## Context and Problem Statement

MCP 2026-07-28 permits a successful `tools/call` result to contain text,
image, audio, resource-link, and embedded-resource content blocks. Em See Pea
currently validates each tool's object-shaped `data`, emits it as
`structuredContent`, and returns one generated or application-supplied text
block. Applications cannot return the other standard content blocks from
direct, mapped, or streaming tools.

This decision determines whether tool handlers should expose the complete
standard content-block union without weakening the existing structured-output,
safe-error, cancellation, or result-size boundaries.

## Decision Drivers

- Support the active MCP tool-result content types through one checked framework boundary.
- Preserve mandatory object-shaped `outputSchema` and validated `data` for this increment.
- Reuse the installed MCP SDK's authoritative content-block schema.
- Keep direct, mapped, and streaming tools on the shared execution path.
- Reject malformed application output before it reaches the client.
- Preserve the current text-only API behavior for existing applications.
- Avoid exposing arbitrary protocol results, application-selected `_meta`, or new authority through resource content.

## Considered Options

1. **Checked MCP content blocks alongside structured data (chosen)**: extend the existing tool result with an optional checked `content` array while retaining mandatory validated `data`.
2. **Raw MCP call-tool results**: let handlers return the entire protocol result, including `structuredContent`, `isError`, and `_meta`.
3. **Text-only tool results**: keep generating one text block from validated structured data or the existing `text` field.

## Decision Outcome

Chosen option: **"Checked MCP content blocks alongside structured data"**,
because it completes the standard unstructured result union without handing
applications an unchecked protocol-output escape hatch.

`ToolResult<Output>` will accept either the existing optional `text` field or
an optional `content` array, never both. Omitting both retains today's single
text block, using the validated data serialized as JSON. The `data` field and
object-shaped `outputSchema` remain mandatory and continue to produce checked
`structuredContent`.

Every supplied content block will be copied, validated, and frozen through the
installed MCP SDK schema before emission. Only the five MCP 2026-07-28 block
variants are accepted: text, image, audio, resource link, and embedded
resource. Unknown fields or malformed blocks cause the existing safe tool
failure and no partial application result is emitted.

The same result contract will flow through the shared checked path for direct,
mapped, and streaming tools. Existing deadline, cancellation, progress-finalization,
safe-error redaction, and whole-result byte limits remain in force. Resource
links and embedded resources are presentation payloads only; they do not grant
access, register a resource, or authorize server-side dereferencing.

This increment does not expose raw `CallToolResult`, handler-selected `isError`
or `_meta`, array or scalar `structuredContent`, catalogue mutation or
notifications, retries, replay, persistence, or reconnect recovery.

## Consequences

### Good

- Applications can return every active MCP content-block type from any supported tool style.
- One installed SDK schema remains the authority for protocol result shapes.
- Structured output keeps its existing schema validation and type inference.
- Existing text-only handlers require no changes.

### Neutral

- Rich content is optional and remains bounded by the existing whole-result size limit.
- Resource links and embedded resources carry client-facing data but no framework authority.
- Array and scalar structured output remain a separate possible increment.

### Bad

- Every rich result adds content-block validation and allocation before serialization.
- Applications must choose between `text` and `content` rather than relying on precedence rules.
- Intentional application error results still use the existing generic safe-error behavior.

## Confirmation

- Type checks accept all five content-block variants for direct, mapped, and streaming tools.
- Type checks reject `text` together with `content` and reject malformed content shapes.
- Black-box checks prove all five blocks reach an MCP 2026-07-28 client unchanged after validation.
- Malformed or extra content fields produce the existing safe tool error and no partial rich result.
- Structured `data` continues to validate independently against `outputSchema`.
- The existing result-size limit covers the final combined `content` and `structuredContent` result.
- Existing explicit-text and generated-text behavior remains unchanged when `content` is omitted.
- Legacy requests retain their current behavior.
- Packed-package and released-package journeys exercise the public rich-result contract.
- Registry readback verifies the released package and its public types.

## Pros and Cons of the Options

### Checked MCP Content Blocks Alongside Structured Data

- Good, because it adds the missing standard block union without bypassing checked structured output.
- Bad, because it adds per-result validation work and a mutually exclusive result shape.

### Raw MCP Call-Tool Results

- Good, because it exposes the entire protocol result with little framework transformation.
- Bad, because it lets application code control protocol fields and structured output outside the existing checked contract.

### Text-Only Tool Results

- Good, because it preserves the smallest possible result API.
- Bad, because applications cannot return standard image, audio, resource-link, or embedded-resource blocks.

## Performance Review

Source: **no data - planning assumptions only**.

The existing one-mebibyte application-result limit bounds additional content
bytes below one mebibyte per request. At ADR-0014's floor of 100 requests per
second, admitted application-selected result bytes remain below 100 MiB per
second before encoding and protocol framing. This is a qualification input,
not a throughput claim.

The JSON tool path must continue to meet ADR-0014's minimum 100 requests per
second, maximum 5 ms p95 framework CPU, maximum 256 KiB p95 transient
allocation, and maximum 2 KiB average framework-added overhead. Qualification
will measure content validation rather than assuming its cost. Streaming tool
results remain outside that budget, so this decision makes no streaming
performance claim.

## Reassessment Criteria

Reassess if the protocol changes the content-block union, measured validation
cannot meet the existing JSON boundary budget without weakening safety, or a
demonstrated application needs raw error results, result `_meta`, or non-object
structured output. Any reassessment must preserve checked application output,
safe errors, cancellation, and explicit result-size limits.
