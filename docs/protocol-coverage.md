# MCP 2026-07-28 Server Coverage

This page shows how much of the active Model Context Protocol (MCP) server
surface Em See Pea supports today.

It is based on the public
[MCP 2026-07-28 schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/5f5440bb26a62e2cf3440b92da5a667efa03b267/schema/2026-07-28/schema.ts)
and the matching
[Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/5f5440bb26a62e2cf3440b92da5a667efa03b267/docs/specification/2026-07-28/basic/transports/streamable-http.mdx).

## What the Statuses Mean

- **Checked**: automated tests cover the behaviour described in this row.
- **Partial**: the common path works, but active protocol behaviour is missing.
- **Not built**: the framework does not advertise or accept this capability.
- **Not checked**: the dependency may handle it, but Em See Pea has no exact
  test and makes no claim.
- **Not used on HTTP**: the protocol uses a different HTTP mechanism.

A checked row is not a claim that the whole protocol is complete.
Evidence links point to executable tests in this repository.

## Requests From Clients

### `server/discover`

**Status: Checked.** Lists the pinned version and only the capabilities
registered by the application. Discovery remains open when tools require
sign-in. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[sign-in tests](../tests/black-box/oauth-protected-tools.test.mjs).

### `tools/list`

**Status: Partial.** Lists registered tools with public input and output
schemas. Advanced tool metadata and changing the list while the server is
running are not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `tools/call`

**Status: Partial.** Supports checked public, signed-in, mapped, and
progress-reporting tools that return a final result. Results that ask the client
for more input are not supported. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[mapped backend tests](../tests/black-box/mapped-adapter.test.mjs), and
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### `resources/list`

**Status: Partial.** Lists registered public resources. Changing the list while
the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `resources/templates/list`

**Status: Partial.** Lists registered public resource address patterns.
Changing the list while the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `resources/read`

**Status: Partial.** Reads registered public resources and checks their result.
Signed-in resources and resource update subscriptions are not supported. See
the [resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `prompts/list`

**Status: Partial.** Lists registered public prompts. Changing the list while
the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `prompts/get`

**Status: Partial.** Gets a registered public prompt and checks its result.
Signed-in prompts are not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `completion/complete`

**Status: Checked.** Suggests bounded, checked values for registered prompt
arguments and resource fields. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).

### `subscriptions/listen`

**Status: Not built.** The current MCP server dependency does not expose a
bounded queue for slow readers. Em See Pea will not add subscriptions until it
can prove that one slow client cannot grow server memory without limit.

## HTTP and Shared Behaviour

### One `POST /mcp` Endpoint

**Status: Checked.** Raw HTTP tests and the official MCP client cover JSON
requests. Common non-POST methods are rejected. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs).

### Protocol Version

**Status: Checked.** Discovery and calls use the pinned version. Missing,
unsupported, and mismatched versions are rejected before authentication or
application work. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[sign-in tests](../tests/black-box/oauth-protected-tools.test.mjs).

### Accepted Response Types

**Status: Partial.** JSON and server-sent event responses work when the client
offers both. Missing or incompatible `Accept` headers do not yet have exact
tests. See the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Request Headers

**Status: Partial.** Tests cover the protocol version, method, name, and
missing or mismatched header rejection before authentication. Tool values
copied into custom HTTP headers are not yet covered. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[sign-in tests](../tests/black-box/oauth-protected-tools.test.mjs).

### Notification `POST` Requests

**Status: Not built.** MCP 2026-07-28 defines the HTTP response mechanics for
notifications but defines no core client notification for Streamable HTTP.
Em See Pea does not yet offer an extension-notification registration point.

### Origin Checks

**Status: Checked.** Disallowed browser origins are rejected before application
work starts. See the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs)
and [deployment-boundary tests](../tests/black-box/production-boundary.test.mjs).

### Request Limits and Safe Errors

**Status: Checked.** Tests cover malformed and oversized input, oversized
output, invalid application output, time limits, and redacted failures. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs).

### Cancellation

**Status: Checked.** Closing a request's response stream cancels cooperating
tools, adapters, resources, resource patterns, prompts, suggestions, and
progress work. See the
[mapped backend tests](../tests/black-box/mapped-adapter.test.mjs),
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs), and
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Progress Updates

**Status: Partial.** Checked and bounded progress works on a local request.
Proxy operation, recovery, and more than one server instance are not supported.
See the [progress tests](../tests/black-box/streaming-progress.test.mjs).

### Server-Sent Event Completion

**Status: Checked.** A progress stream ends with one checked final response and
then closes. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Proxy Buffering Header

**Status: Checked.** Streamed responses include `X-Accel-Buffering: no` so
compatible proxy servers do not hold progress updates. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Stream Resumption

**Status: Checked.** MCP 2026-07-28 does not support resuming a stream with
`Last-Event-ID`. Tests prove that a stale header starts a fresh progress stream
without replay. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Requests for More Client Input

**Status: Not built.** Sampling, elicitation, and roots through multi-round-trip
results are not supported. The existing form renderers do not make this
protocol claim.

### Long-Lived Change Notifications

**Status: Not built.** Tool, resource, and prompt list changes and resource
updates need `subscriptions/listen`, which is not yet supported.

### `notifications/cancelled` From a Client

**Status: Not used on HTTP.** MCP 2026-07-28 uses response-stream closure as the
cancellation signal for Streamable HTTP. The notification is for the standard
input/output transport.

## Why Full Coverage Is Not Claimed

Em See Pea supports useful parts of the active server surface, but it does not
yet support every active request, result shape, notification, and transport
rule. In particular, it lacks multi-round-trip input requests and bounded
subscriptions.

The full active server-surface claim stays withdrawn until a fresh comparison
with the pinned public specification proves that this page lists every active
server rule. Every partial, not-built, and not-checked row must then have exact
tests from clean checkouts with two independent MCP clients.

## Next Proof

Work should close one row at a time:

1. add checked results that ask a client for more input
2. add tests for the next unsupported result shape named on this page
3. cover custom request-header projection and validation
4. add subscriptions only after slow-reader memory is bounded
5. compare this page with every active server rule in the pinned specification
6. rerun every row on this page with two independent clients from clean copies

If public MCP sources change, update this page and its tests before changing the
claim.
