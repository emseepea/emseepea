---
status: "proposed"
date: 2026-09-11
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# Opt-In Bounded Request-Scoped MCP Logging

## Context and Problem Statement

MCP 2026-07-28 retains a deprecated server logging feature. A client can ask
for messages at or above a chosen level by putting
`io.modelcontextprotocol/logLevel` in one request. The server can then send
`notifications/message` on that request's response stream.

Em See Pea does not expose this feature. Adding it creates a client-visible
application output channel, so the framework must decide how applications opt
in, what handlers can send, and how the channel stays bounded. This is separate
from framework observability, which records redacted operational events for the
server operator rather than sending application messages to an MCP client.

This decision does not restore `logging/setLevel`, add connection state, or add
retries, replay, persistence, or reconnect recovery.

## Decision Drivers

- Complete one small remaining part of MCP 2026-07-28.
- Reuse the installed MCP SDK's request-level opt-in and severity filtering.
- Keep the existing behavior unchanged unless an application enables logging.
- Prevent logs from bypassing authentication, cancellation, output limits, or
  the final-result boundary.
- Keep client-visible logging separate from framework observability.
- Avoid reviving a removed connection-level logging method on legacy routes.

## Considered Options

1. **Opt-in bounded request-scoped logging using the MCP SDK** - Applications
   explicitly enable logging and named handlers receive a checked `reportLog`
   function.
2. **Keep logging unsupported** - Do not implement the deprecated feature.
3. **Expose unbounded SDK logging directly** - Give handlers the SDK function
   without framework checks or limits.

## Decision Outcome

Chosen option: **"Opt-in bounded request-scoped logging using the MCP SDK"**,
because it implements the protocol feature without introducing connection
state or an unbounded output path.

`createEmseepea` gains one optional logging setting. When absent, the server
does not advertise logging, handler contexts do not expose `reportLog`, and
existing JSON responses remain unchanged. When present, the server advertises
logging only for MCP 2026-07-28 requests and uses adaptive POST response
streaming so requested messages can precede the final result.

Direct and streaming tool handlers, static-resource handlers,
resource-template handlers, and prompt handlers receive `reportLog`.
Mapped-tool adapters and completion handlers do not. The function accepts one
standard MCP log level, optional bounded logger text, and JSON-serializable
data. The framework delegates the client's requested threshold to the installed
MCP SDK. If the request has no log-level metadata, no message is emitted.

Startup configuration sets positive limits for report attempts and bytes per
message. Total possible log bytes are bounded by their product. The existing
progress defaults of 32 attempts and 8 KiB per message are the initial logging
defaults, but logging has separately named settings. Invalid, oversized,
over-count, late, cancelled, or failed reporting makes the operation fail with
the existing generic public error. Handlers await each report. No message may
appear after the terminal result or error.

Protected operations authenticate and authorize before response streaming or
handler work. A message stays on the request that produced it. Em See Pea never
automatically copies arguments, results, headers, tokens, principals, URLs, or
raw errors into a client log. Applications remain responsible for the content
they explicitly pass to `reportLog`.

The deprecated `logging/setLevel` request remains unreachable on every served
protocol revision. Legacy requests neither advertise nor receive this logging
API. This increment adds no HTTP GET stream, session, replay, persistence, or
recovery behavior.

## Consequences

### Good

- Applications can use the remaining request-scoped MCP logging feature.
- Clients receive messages only when they explicitly request a log level.
- Existing servers and legacy requests keep their current behavior by default.
- Event volume and size are bounded under application mistakes or slow clients.
- The implementation reuses SDK wire behavior instead of creating another
  logging protocol.

### Neutral

- Applications decide what safe client-visible data to log.
- Logging responses use the existing POST-scoped SSE path when enabled.

### Bad

- This adds public configuration and handler-context API for a deprecated
  protocol feature.
- A reporting failure fails the operation even though logging is secondary to
  its business result.
- The streaming logging path needs separate interoperability and load evidence.

## Confirmation

- Without logging configuration, discovery, handler types, and JSON response
  behavior remain unchanged.
- With logging configured, modern discovery advertises `logging`; legacy
  discovery does not.
- Only the named direct handler contexts expose `reportLog`.
- A pinned official client receives only requested messages at or above its
  request-level threshold, followed by exactly one checked final result.
- A request without `io.modelcontextprotocol/logLevel` receives no log message.
- Invalid levels, logger text, non-JSON data, oversized messages, too many
  attempts, cancellation, late calls, and delivery failures fail closed.
- Authentication and authorization failures produce no stream and make no
  application call.
- Concurrent requests cannot receive each other's messages.
- `logging/setLevel` is rejected before application work for modern and legacy
  requests.
- Framework observability still receives only its existing redacted event and
  cannot change protocol output.
- Raw HTTP, official-client, packed-package, slow-reader, disconnect, and
  bounded-load checks pass before release.
- Documentation calls this channel deprecated and distinguishes it from server
  operator logging and observability.

## Pros and Cons of the Options

### Opt-In Bounded Request-Scoped Logging Using the MCP SDK

- Good: Implements the protocol feature through the existing checked request
  and streaming boundary.
- Bad: Adds API and qualification work for a deprecated feature.

### Keep Logging Unsupported

- Good: Adds no code or public API.
- Bad: Leaves a defined MCP 2026-07-28 server behavior unsupported.

### Expose Unbounded SDK Logging Directly

- Good: Requires less wrapper code.
- Bad: Creates an unbounded, weakly checked client-visible output path.

## Performance Review

Source: **no data - planning assumptions only**.

At the default limits, one request could emit at most 32 messages of 8 KiB
each, or 256 KiB before framing. At 100 such requests per second, that would be
25 MiB per second before framing. This is a worst-case input for qualification,
not a performance claim. Existing non-streaming performance evidence does not
cover this path.

## Reassessment Criteria

Reassess if MCP removes the deprecated logging types, replaces them with a new
standard client-visible diagnostic channel, or measured load shows the default
limits are unsuitable.
