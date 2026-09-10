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
registered by the application. Discovery remains open by default when
capabilities require authentication. Applications may explicitly protect
discovery and filter it by principal permissions. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs).
Lifecycle-hidden capabilities remain advertised as callable categories while
their individual entries are omitted, as covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `tools/list`

**Status: Partial.** Lists visible tools with public input and output schemas,
titles, icons, annotations, access policy, and public application metadata. Changing
the list while the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs). Hidden but
callable tools are covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `tools/call`

**Status: Partial.** Supports checked public, protected, mapped, and
progress-reporting tools. A direct tool may ask a capable client for more input
before returning its final result. Mapped and progress-reporting tools cannot.
See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[mapped backend tests](../tests/black-box/mapped-adapter.test.mjs),
[progress tests](../tests/black-box/streaming-progress.test.mjs), and
[client-input tests](../tests/black-box/input-required.test.mjs). Direct calls to
known lifecycle-hidden tools and their later removal are covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `resources/list`

**Status: Partial.** Lists visible public and protected resources. Changing the list while
the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).
The result contains metadata for registered static resources. It does not return
resource contents, query application records, or expand resource templates.
Lifecycle-hidden resource listing is covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `resources/templates/list`

**Status: Partial.** Lists visible public and protected resource address patterns.
Changing the list while the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).
The result contains metadata for registered URI templates. It does not return
resource contents, query application records, or list matching concrete URIs.
Lifecycle-hidden template listing is covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `resources/read`

**Status: Partial.** Reads registered public or protected resources and checks their result.
A resource may ask a capable client for more input before returning its final
result. Resource update subscriptions are not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs) and
[client-input tests](../tests/black-box/input-required.test.mjs). Reads of known
lifecycle-hidden resources and templates, followed by removal, are covered by
the [discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `prompts/list`

**Status: Partial.** Lists visible public and protected prompts. Changing the list while
the server is running is not supported. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).
Lifecycle-hidden prompt listing is covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `prompts/get`

**Status: Partial.** Gets a registered public or protected prompt and checks its result. A
prompt may ask a capable client for more input before returning its final
result. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs) and
[client-input tests](../tests/black-box/input-required.test.mjs). Known
lifecycle-hidden prompts remain callable until removal, as covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `completion/complete`

**Status: Checked.** Suggests bounded, checked values for registered prompt
arguments and resource fields. Completion inherits the referenced prompt or
resource-template access policy. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Completion for known lifecycle-hidden prompts and templates, authorization
failure, and later removal are covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

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
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs).

### Result Envelopes

**Status: Checked.** Every enabled successful operation returns
`resultType: "complete"`. Discovery, list, and resource-reading results also
tell clients not to reuse the response and not to share it between callers by
returning `ttlMs: 0` and `cacheScope: "private"`.

Raw HTTP tests cover every enabled operation. The pinned official client also
successfully reads all nine results. The separately tested
`resultType: "input_required"` path is covered by the
[client-input tests](../tests/black-box/input-required.test.mjs). See the
[result-envelope tests](../tests/black-box/resources-prompts.test.mjs) and
[streaming tests](../tests/black-box/streaming-progress.test.mjs).

### Advertised Names, Icons, and Hints

**Status: Checked.** Applications can give the server a website address. They
can give the server and its tools, resources, resource address patterns, and
prompts human-friendly titles, descriptions, and icons. Tools can provide
standard usage hints. Resources can provide audience, importance, and
known-size details. Each item may also include public application metadata.

Tool annotations are hints for clients. They do not prove that a tool is safe,
grant permission, or replace authentication and authorization checks.

The framework checks and copies these details before startup. Tests prove that
invalid details fail early, later changes to the application's objects have no
effect, and application metadata cannot replace the framework's tool-access
description. See the
[protocol metadata tests](../tests/black-box/protocol-metadata.test.mjs).

### Cache Instructions

**Status: Checked.** Applications can tell clients how long they may reuse
discovery details, lists, and resource content. They can also say whether a
shared cache may keep the result. An individual resource or reusable resource
address can override either part of the resource-reading instruction.

Invalid instructions and instructions for features the application has not
enabled stop the server from being created. Results that ask the client for
more input are never marked as reusable. Tests cover raw HTTP, the pinned MCP
client, bounded catalogue pages, defaults, overrides, and proof that later
changes to caller-owned configuration objects have no effect. See the
[cache-instruction tests](../tests/black-box/cache-hints.test.mjs).

### List Pagination

**Status: Checked.** Applications can opt in to bounded pages for tool,
resource, resource-address, and prompt catalogues. Page size is limited to 100,
and a separate byte limit stops oversized catalogue pages.

Cursors are tied to the exact ordered public catalogue, list method, and page
limits. Identical server instances accept the same cursor. Changed, malformed,
and cross-method cursors are rejected without calling application handlers.
Raw HTTP and the pinned official client cover all four list methods across
three pages. Catalogues remain fixed for the lifetime of the server. See the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).

### Accepted Response Types

**Status: Checked.** Clients must offer both JSON and server-sent events.
Tests reject missing, wildcard-only, and single-type `Accept` values before authentication
or application work. They accept both tested orders and parameters. This is a
narrow framework check, not a claim of complete HTTP content negotiation. See
the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs), and
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Request Headers

**Status: Checked.** Tests cover the protocol version, method, name, and tool
values copied into custom HTTP headers. They cover string, integer, and boolean
values, safe encoding, optional values, unknown headers, and rejection of
invalid declarations or missing, different, and malformed values before the
tool runs. See the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs), and
[custom request-header tests](../tests/black-box/request-headers.test.mjs).

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

**Status: Partial.** Public and protected tools can send bounded progress through
a trusted proxy on the same POST response. The framework authenticates and
authorizes protected calls before application code or the event stream begins.
Independent requests can reach different server processes without requiring
the client to stay with one process. Public proxy progress was first published in
`@emseepea/server` 0.0.3.
See the [release evidence](https://github.com/emseepea/emseepea/releases/tag/%40emseepea/server%400.0.3).

The [proxy tests](../tests/black-box/proxy-progress.test.mjs) check authentication
failures, incremental delivery through the official client and raw HTTP,
cross-process isolation, cancellation, and configured limits. The
[CI load test](../tests/load/proxy-progress.test.mjs) adds concurrent protected
calls and paused readers, with fixed memory limits.

[Node.js 22 and 24 passed](https://github.com/emseepea/emseepea/actions/runs/33341972321)
at revision `0178dc802c52e395f4907b90b2fbd2bfc324cb9c`. The tested setup uses
two independent processes behind an HTTP proxy that supplies forwarded HTTPS
metadata. It does not test a real TLS terminator or every proxy product.

There is no throughput or load-balancing fairness guarantee. Rate limits remain
per server, and application state is not shared. Paused-reader memory checks
do not prove that a slow reader slows the producer. Recovery, replay, and
subscriptions remain unsupported.

### Server-Sent Event Completion

**Status: Checked.** A progress stream ends with one checked final response and
then closes. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Proxy Buffering Header

**Status: Checked.** Streamed responses include `X-Accel-Buffering: no`, which
asks compatible proxies not to hold progress updates. It is not a guarantee
that every proxy obeys. The
[progress tests](../tests/black-box/streaming-progress.test.mjs) check the header;
the [proxy tests](../tests/black-box/proxy-progress.test.mjs) check delivery before
the final response in the tested proxy setup.

### Stream Resumption

**Status: Checked.** MCP 2026-07-28 does not support resuming a stream with
`Last-Event-ID`. Tests prove that a stale header starts a fresh progress stream
without replay. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Requests for More Client Input

**Status: Checked.** Application authors can create direct tools, resources,
resource address patterns, and prompts that pause and ask a capable client for
form input or URL-mode elicitation. Each reply reaches a fresh request and is
treated as untrusted input.

Tests cover accepted, declined, and cancelled replies, invalid client
responses, oversized input-required results, time limits, and disconnections.
They also prove that every signed-in round checks the caller again and that
retries use fresh JSON-RPC identifiers. Opaque `requestState` is deliberately
rejected because the framework does not yet provide the integrity and replay
controls it would need. See the
[client-input tests](../tests/black-box/input-required.test.mjs).

### Long-Lived Change Notifications

**Status: Not built.** Tool, resource, and prompt list changes and resource
updates need `subscriptions/listen`, which is not yet supported.

### `notifications/cancelled` From a Client

**Status: Not used on HTTP.** MCP 2026-07-28 uses response-stream closure as the
cancellation signal for Streamable HTTP. The notification is for the standard
input/output transport.

## Operations Support

### Observability Adapters

**Status: Partial.** Applications can opt into structured logging,
OpenTelemetry, or both through the same framework-redacted event contract.
Each `/mcp` request produces a bounded event containing only known protocol and
capability names, HTTP method and status, completion outcome, and duration.

The [observability HTTP tests](../tests/black-box/telemetry.test.mjs) cover two
adapters, stable order, redaction, unknown names, adapter failures, and bounded
delivery and flush. HTTP completion is not treated as tool success. The CI
benchmark compares disabled and enabled built-in OpenTelemetry adapters without
an exporter; it does not measure an adopter's exporter or log destination.

### Dependency Readiness and Shutdown Flushing

**Status: Partial.** The server includes an optional dependency-readiness
callback. Configured observability adapters may provide a shutdown-flush
callback.

Readiness uses fixed responses without dependency details. Tests cover failure,
recovery, timeouts, late callback results, cancellation, and one unfinished
dependency check at a time. An unhealthy readiness response does not disable
independent tool calls. Without a callback, readiness does not check dependencies.

Shutdown stops admission and bounds request draining separately from
observability delivery and flushing. Every adapter receives an independent
bounded flush opportunity. Tests cover forced stream closure, stalled close
hooks, flusher failures, expired budgets, and repeated close calls. See the
[operations HTTP tests](../tests/black-box/operations.test.mjs).

An uncooperative callback can outlive the framework's wait. Successful shutdown
does not prove delivery to an external observability service. This limit keeps
the operations claim partial.

## Optional Feedback Package

**Status: Checked application capability, not an MCP protocol claim.**
`@emseepea/feedback` composes ordinary tools through `additionalTools`. Tests
cover bounded detailed submissions, protected append-only conversations,
client-scoped access, first-offer receipts, deadlines, cancellation, minimal
events, PostgreSQL, Firestore, and deterministic GitHub and Zendesk HTTP
contracts. Checked webhook boundaries authenticate, validate, scope, bound, and
deduplicate provider changes.

GitHub and Zendesk checks do not prove behavior in a live customer account.
Provider-native assignment, categories, milestones, status automation,
notifications, and email require deployment-specific qualification. Feedback
performance is not claimed. See the
[`@emseepea/feedback` guide](../packages/feedback/README.md).

## Why Full Coverage Is Not Claimed

Em See Pea supports useful parts of the active server surface, but it does not
yet support every active request, result shape, notification, and transport
rule. In particular, it lacks bounded subscriptions and several partial
capabilities listed above.

The full active server-surface claim stays withdrawn until a fresh comparison
with the pinned public specification proves that this page lists every active
server rule. Every partial, not-built, and not-checked row must then have exact
tests from clean checkouts with two independent MCP clients.

## Next Proof

Work should close one row at a time:

1. add subscriptions only after slow-reader memory is bounded
2. compare this page with every active server rule in the pinned specification
3. rerun every row on this page with two independent clients from clean copies

If public MCP sources change, update this page and its tests before changing the
claim.
