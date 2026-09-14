# MCP 2026-07-28 Server Coverage

This page shows how much of the active Model Context Protocol (MCP) server
surface Em See Pea supports today.

The active target remains MCP `2026-07-28`. The same stateless `POST /mcp`
endpoint also provides a verified compatibility subset for `2025-11-25`,
`2025-06-18`, `2025-03-26`, `2024-11-05`, and `2024-10-07`. For each legacy
revision, an independent SDK client completes initialization, tool listing,
and tool invocation. See the
[legacy protocol tests](../tests/black-box/legacy-protocol.test.mjs).

It is based on the public
[MCP 2026-07-28 schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/5f5440bb26a62e2cf3440b92da5a667efa03b267/schema/2026-07-28/schema.ts)
and the matching
[Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/5f5440bb26a62e2cf3440b92da5a667efa03b267/docs/specification/2026-07-28/basic/transports/streamable-http.mdx).

## What the Statuses Mean

- **Fully implemented and verified**: Em See Pea implements this behaviour and
  has exact automated tests for it.
- **Fully implemented for compatibility revisions**: Em See Pea supports this
  behaviour for older MCP revisions. MCP `2026-07-28` removed or replaced it.
- **Partially implemented**: one part is ready, and one part is intentionally
  not supported or still missing. These rows use the same shape:
  **What works**, **Not supported**, **Why**, and **If you need it**.
- **Not implemented**: Em See Pea does not advertise or accept this capability.
- **Intentionally unsupported**: Em See Pea deliberately omits the feature.
- **Not applicable to Streamable HTTP**: this protocol behaviour belongs to a
  different transport.
- **Application capability, not an MCP protocol claim**: the feature is useful,
  tested application code, but it is not part of the MCP server surface.

One fully implemented row is not a claim that the whole protocol is complete.
Evidence links point to executable tests in this repository.

## Known Optional MCP Gaps

The known non-deprecated MCP `2026-07-28` gaps on this page are optional
capabilities:

- Em See Pea does not support tool, resource, resource-template, or prompt
  list-change notifications inside one running process. Catalogue changes are
  delivered by redeploying and reconnecting. See
  [ADR-0080: Immutable Capability Catalogues Through Redeployment](decisions/0080-immutable-capability-catalogues-through-redeployment.proposed.md).
- Em See Pea does not offer a generic extension-notification registration point
  for client notification `POST` requests.

This is not a full protocol-completeness claim. A full claim still requires a
fresh comparison with the pinned public specification and two independent
client checks for every row.

Several other limits on this page are not missing MCP features. They are
transport boundaries, deprecated-feature boundaries, operational guarantees
outside MCP, or deployment-specific checks that each application must qualify.

## If You Need an Unsupported Capability

Use the alternative named in the relevant row when one fits. An application
event service can notify every server process, and each process can call
`notifyResourceUpdated` for its connected clients.

If you must add an MCP method or notification that Em See Pea does not expose,
there is no supported Em See Pea extension hook for that today. Build that
server path directly with `@modelcontextprotocol/server`,
`@modelcontextprotocol/fastify`, and `@modelcontextprotocol/node`, or keep the
existing MCP server alongside Em See Pea during migration. The application then
owns validation, authentication, limits, cancellation, and shutdown for that
path. Do not depend on Em See Pea's private internals.

## Requests From Clients

### `server/discover`

**Status: Fully implemented and verified.** Lists the pinned version and only the capabilities
registered by the application. Discovery remains open by default when
capabilities require authentication. Applications may explicitly protect
discovery and filter it by principal permissions. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs).
Lifecycle-hidden capabilities remain advertised as callable categories while
their individual entries are omitted, as covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `ping`

**Status: Fully implemented for compatibility revisions.** Supported 2025-era
compatibility revisions retain `ping`, and the generic SDK still handles it on
those paths. MCP `2026-07-28` removed `ping` from its version-specific request
registry, so Em See Pea does not admit it as an MCP `2026-07-28` request.

This is a protocol-version boundary, not an unfinished active capability. If an
application needs a current health check, use the non-MCP `/healthz` endpoint.
See
[ADR-0089: No `ping` in Model Context Protocol (MCP) `2026-07-28` Beyond Existing Legacy Compatibility](decisions/0089-no-modern-ping-beyond-existing-legacy-compatibility.proposed.md).

### `tools/list`

**Status: Fully implemented and verified.** Em See Pea lists visible tools with public input schemas,
optional output schemas, titles, icons, annotations, access policy, and public
application metadata. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs). Hidden but
callable tools are covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

The catalogue is immutable after startup and advertises `listChanged: false`.
Deploy a new server version and let clients reconnect when the tool list
changes.

### `tools/call`

**Status: Fully implemented and verified.** Em See Pea supports validated
public, protected, mapped, and
progress-reporting tools. A direct tool may ask a capable client for more input
before returning its final result. Handlers may keep the validated
`{ data, text? }` convenience form or return a validated protocol-native result. Protocol-native
results support text, image, audio, resource-link, embedded-resource content,
safely representable JSON structured content, deliberate application errors, and
client-visible metadata. Declared output schemas remain mandatory for the
convenience form and are enforced on successful protocol-native structured
content. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[protocol-native result tests](../tests/black-box/rich-tool-results.test.mjs),
[mapped backend tests](../tests/black-box/mapped-adapter.test.mjs),
[progress tests](../tests/black-box/streaming-progress.test.mjs), and
[client-input tests](../tests/black-box/input-required.test.mjs). Direct calls to
known lifecycle-hidden tools and their later removal are covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

Mapped and progress-reporting tool helpers do not support multi-round client
input. Use a direct tool for that interaction, or split the operation into
separate explicit tools.

### `resources/list`

**Status: Fully implemented and verified.** Em See Pea lists visible public and
protected static resources. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).
The result contains metadata for registered static resources. It does not return
resource contents, query application records, or expand resource templates.
Lifecycle-hidden resource listing is covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

The catalogue is immutable after startup. Deploy a new server version and let
clients reconnect when the resource list changes.

### `resources/templates/list`

**Status: Fully implemented and verified.** Em See Pea lists visible public and protected resource
templates. Each template is a registered URI pattern. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).
The result contains metadata for registered resource templates. It does not return
resource contents, query application records, or list matching concrete URIs.
Lifecycle-hidden resource-template listing is covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

The catalogue is immutable after startup. Deploy a new server version for
catalogue changes. A template describes an address pattern; put dynamic lookup
inside its resource read handler.

### `resources/read`

**Status: Fully implemented and verified.** Em See Pea reads registered public
or protected resources and validates their result. A resource may ask a capable client for more input before
returning its final result. A resource read may return several text or binary
content items. Each returned URI identifies one item. It does not need to match
the URI that the client requested. Em See Pea still authorizes the resource
that the client requested. Any cache instructions apply to the complete
response.

Returning an item URI does not, by itself, register a resource or let a client
read that URI through Em See Pea. A client may still read it if the URI
separately identifies an already registered static resource or matches an
already registered resource template, and the client satisfies that
capability's access policy.

Resource handlers can send bounded progress when the current request asks for
it. Progress uses only that request's token and finishes before the resource
result.

Resource update subscriptions are covered separately below. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs),
[resource and prompt progress tests](../tests/black-box/resource-prompt-progress.test.mjs), and
[client-input tests](../tests/black-box/input-required.test.mjs). Reads of known
lifecycle-hidden resources and templates, followed by removal, are covered by
the [discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

Returned item URIs do not dynamically register new readable resources. Register
a static resource or resource template for each URI shape the client may read
later. This keeps authorization bound to a declared resource.

### `prompts/list`

**Status: Fully implemented and verified.** Em See Pea lists visible public and
protected prompts. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Opt-in bounded pages are covered by the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).
Lifecycle-hidden prompt listing is covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

The catalogue is immutable after startup. Deploy a new server version and let
clients reconnect when the prompt list changes.

### `prompts/get`

**Status: Fully implemented and verified.** Em See Pea gets a registered public
or protected prompt and validates its result. A prompt may ask a capable client for more input before
returning its final result. A prompt can send bounded progress when the current
request asks for it. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs),
[resource and prompt progress tests](../tests/black-box/resource-prompt-progress.test.mjs), and
[client-input tests](../tests/black-box/input-required.test.mjs). Known
lifecycle-hidden prompts remain callable until removal, as covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `completion/complete`

**Status: Fully implemented and verified.** Suggests bounded, validated values
for registered prompt arguments and resource fields. Completion inherits the referenced prompt or
resource-template access policy. See the
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs).
Completion for known lifecycle-hidden prompts and templates, authorization
failure, and later removal are covered by the
[discovery-suppression tests](../tests/black-box/discovery-suppression.test.mjs).

### `subscriptions/listen`

**Status: Partially implemented.**

**What works:** An application can opt into resource-update subscriptions. Each
request listens to one registered static resource URI or one concrete URI that
matches a registered resource template. The framework authenticates access to a
protected resource before opening the stream and bounds active streams, stream
lifetime, event count, event size, and total event bytes. Overflow closes only
the affected stream. See the
[resource subscription tests](../tests/black-box/resource-subscriptions.test.mjs).

**Not supported:** Replay, reconnect recovery, cross-process subscriptions, or
tool, resource, template, or prompt list-change subscriptions.

**Why:** Subscriptions and notifications are process-local.

**If you need it:** For cross-process resource updates, let each process consume
the same application event service and call `notifyResourceUpdated` locally.
Clients can re-read the resource after reconnecting when they need current
state. For catalogue changes, redeploy and let clients reconnect.

## HTTP and Shared Behaviour

### One `POST /mcp` Endpoint

**Status: Fully implemented and verified.** Raw HTTP tests and the official MCP client cover JSON
requests in both protocol eras. Common non-POST methods are rejected with
`Allow: POST`; legacy sessions, GET streams, replay, and resumption are not
supported. See the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs)
and [legacy protocol tests](../tests/black-box/legacy-protocol.test.mjs).

### Protocol Version

**Status: Fully implemented and verified.** Modern discovery and calls use the pinned `2026-07-28`
version. Legacy initialization is limited to the five compatibility revisions
listed above. Missing, unsupported, malformed, and mixed-era versions are
rejected before authentication or application work. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs) and
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs), and
[legacy protocol tests](../tests/black-box/legacy-protocol.test.mjs).

### Result Envelopes

**Status: Fully implemented and verified.** Every enabled successful operation returns
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

**Status: Fully implemented and verified.** Applications can give the server a website address. They
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

**Status: Fully implemented and verified.** Applications can tell clients how long they may reuse
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

**Status: Fully implemented and verified.** Applications can opt in to bounded pages for tool,
resource, resource-address, and prompt catalogues. Page size is limited to 100,
and a separate byte limit stops oversized catalogue pages.

Cursors are tied to the exact ordered public catalogue, list method, and page
limits. Identical server instances accept the same cursor. Changed, malformed,
and cross-method cursors are rejected without calling application handlers.
Raw HTTP and the pinned official client cover all four list methods across
three pages. Catalogues remain fixed for the lifetime of the server. See the
[list-pagination tests](../tests/black-box/list-pagination.test.mjs).

### Accepted Response Types

**Status: Fully implemented and verified.** Clients must offer both JSON and server-sent events.
Tests reject missing, wildcard-only, and single-type `Accept` values before authentication
or application work. They accept both tested orders and parameters. This is a
narrow framework check, not a claim of complete HTTP content negotiation. See
the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs), and
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Request Headers

**Status: Fully implemented and verified.** Tests cover the protocol version, method, name, and tool
values copied into custom HTTP headers. They cover string, integer, and boolean
values, safe encoding, optional values, unknown headers, and rejection of
invalid declarations or missing, different, and malformed values before the
tool runs. These envelope headers apply to MCP `2026-07-28`; correctly
classified legacy requests use their revision's standard header rules. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs),
[authentication tests](../tests/black-box/oauth-protected-tools.test.mjs), and
[custom request-header tests](../tests/black-box/request-headers.test.mjs), and
[legacy protocol tests](../tests/black-box/legacy-protocol.test.mjs).

### Notification `POST` Requests

**Status: Not implemented.** MCP 2026-07-28 defines HTTP response mechanics for
notifications, but defines no core client notification for Streamable HTTP.
Em See Pea does not yet offer a generic extension-notification registration
point.

**If you need it:** Use ordinary tools, resources, prompts, or
`subscriptions/listen` when those fit. Otherwise, use the direct SDK path
described in [If You Need an Unsupported Capability](#if-you-need-an-unsupported-capability).
An integrated Em See Pea extension point would need an ADR and exact wire tests
before Em See Pea could claim support.

### Origin Checks

**Status: Fully implemented and verified.** Disallowed browser origins are rejected before application
work starts. See the [basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs)
and [deployment-boundary tests](../tests/black-box/production-boundary.test.mjs).

### Request Limits and Safe Errors

**Status: Fully implemented and verified.** Tests cover malformed and oversized input, oversized
output, invalid application output, time limits, and redacted failures. See the
[basic HTTP tests](../tests/black-box/basic-no-ui.test.mjs).

### Cancellation

**Status: Fully implemented and verified.** Closing a request's response stream cancels cooperating
tools, adapters, resources, resource patterns, prompts, suggestions, and
progress work. See the
[mapped backend tests](../tests/black-box/mapped-adapter.test.mjs),
[resource and prompt tests](../tests/black-box/resources-prompts.test.mjs), and
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Progress Updates

**Status: Partially implemented.**

**What works:** Public and protected tools, resources, and prompts can send bounded
progress through a trusted proxy on the same POST response. Resource and prompt
handlers receive a reporter only when the current request includes a progress
token. The framework authenticates and authorizes protected calls before
application code or the event stream begins.
Independent requests can reach different server processes without requiring
the client to stay with one process. Public proxy progress was first published in
`@emseepea/server` 0.0.3.
See the [release evidence](https://github.com/emseepea/emseepea/releases/tag/%40emseepea/server%400.0.3).

The [proxy tests](../tests/black-box/proxy-progress.test.mjs) check authentication
failures, incremental delivery through the official client and raw HTTP,
cross-process isolation, cancellation, and configured limits. The
[resource and prompt progress tests](../tests/black-box/resource-prompt-progress.test.mjs)
check official-client delivery, per-request token isolation, terminal ordering,
late reporting, and configured event limits. The
[CI load test](../tests/load/proxy-progress.test.mjs) adds concurrent protected
calls and paused readers, with fixed memory limits.

[Node.js 22 and 24 passed](https://github.com/emseepea/emseepea/actions/runs/33341972321)
at revision `0178dc802c52e395f4907b90b2fbd2bfc324cb9c`. The tested setup uses
two independent processes behind an HTTP proxy that supplies forwarded HTTPS
metadata. It does not test a real TLS terminator or every proxy product.

**Not supported:** Throughput guarantees, load-balancing fairness, shared
application state, replay, or reconnect recovery for progress streams.

**Why:** Progress is request-scoped and process-local. The tests prove bounded
delivery in the supported path, not every proxy or deployment topology.

**If you need it:** Keep progress request-scoped, use your deployment layer for
routing guarantees, and add application-level recovery for work that must
survive reconnects.

### Server-Sent Event Completion

**Status: Fully implemented and verified.** A progress stream ends with one
validated final response and then closes. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Client-Visible Log Messages

**Status: Fully implemented and verified.** Applications can opt into the deprecated MCP 2026-07-28
request-scoped logging channel. Named direct handlers receive a bounded
`reportLog` function. A client receives `notifications/message` only when that
request supplies `io.modelcontextprotocol/logLevel`, and the installed MCP SDK
applies the requested severity threshold.

Logging is not advertised when disabled or on legacy requests. The removed
`logging/setLevel` method remains unavailable. This client-visible application
output is separate from the redacted server-operator observability adapters;
the framework does not copy arguments, results, credentials, or errors into it.
There is no session state, replay, persistence, or reconnect recovery. See the
[client logging tests](../tests/black-box/client-logging.test.mjs). The
[logging load check](../tests/load/client-logging.test.mjs) runs the real
framework path with concurrent paused readers and fixed memory ceilings. Its
measurements qualify this streaming path; they do not claim conformance to the
separate JSON-boundary performance budget.

### Proxy Buffering Header

**Status: Fully implemented and verified.** Streamed responses include `X-Accel-Buffering: no`, which
asks compatible proxies not to hold progress updates. It is not a guarantee
that every proxy obeys. The
[progress tests](../tests/black-box/streaming-progress.test.mjs) check the header;
the [proxy tests](../tests/black-box/proxy-progress.test.mjs) check delivery before
the final response in the tested proxy setup.

### Stream Resumption

**Status: Fully implemented and verified.** MCP 2026-07-28 does not support resuming a stream with
`Last-Event-ID`. Tests prove that a stale header starts a fresh progress stream
without replay. See the
[progress tests](../tests/black-box/streaming-progress.test.mjs).

### Requests for More Client Input

**Status: Fully implemented and verified.** Application authors can create direct tools, resources,
resource address patterns, and prompts that pause and ask a capable client for
form input or URL-mode elicitation. Each reply reaches a fresh request and is
treated as untrusted input.

Tests cover accepted, declined, and cancelled replies, invalid client
responses, oversized input-required results, time limits, and disconnections.
They also prove that every signed-in round checks the caller again and that
later rounds use fresh JSON-RPC identifiers.

Signed `requestState` is opt-in for direct tools, static resources, resource
templates, and prompts. Tests cover both protocol-valid result shapes,
tampering, expiry, wire-size limits, method and capability binding, principal
binding, key mismatch, and continuation on another process with the same key.
Signing does not provide encryption, single use, or replay prevention. See the
[client-input tests](../tests/black-box/input-required.test.mjs).

### Client Workspace Roots

**Status: Fully implemented and verified.** Applications opt in with `clientRoots`. Direct tools,
static resources, resource templates, and prompts can request `roots/list`
through `input_required`. The framework validates roots before invoking the
continuation handler, bounds their count and request size, and preserves
authorization on every round. The handler selects its expected response key
using `rootsResponse`. Roots confer no permissions and are never dereferenced.
See the [client roots tests](../tests/black-box/client-roots.test.mjs).

This deprecated MCP feature does not add roots-change notifications or sessions.

### MCP Sampling

**Status: Intentionally unsupported.** MCP 2026-07-28 deprecates
`sampling/createMessage`, tells new implementations not to adopt it, and
recommends direct integration with model-provider APIs. Em See Pea exposes no
Sampling request helper, response accessor, or accepted client-input request
type. Applications that need model generation integrate with their chosen
provider directly. A hand-built Sampling request is rejected by the validated
client-input boundary before delivery or continuation work.

### Long-Lived Change Notifications

**Status: Partially implemented.**

**What works:** Applications can publish an update for a registered resource URI
with `notifyResourceUpdated`. Matching `subscriptions/listen` streams receive
`notifications/resources/updated`.

**Not supported:** Tool, resource, resource-template, and prompt list-change
notifications.

**Why:** Catalogue changes require redeployment, and modern discovery advertises
`listChanged: false`.

**If you need it:** Redeploy with the new catalogue and let clients reconnect
and list again. If catalogue changes must happen within one running process,
use the direct SDK path described above. Reassess ADR-0080 before adding this
behaviour to Em See Pea.

### `notifications/cancelled` From a Client

**Status: Not applicable to Streamable HTTP.** MCP 2026-07-28 uses response-stream closure as the
cancellation signal for Streamable HTTP. The notification is for the standard
input/output transport.

## Operations Support

### Observability Adapters

**Status: Partially implemented.**

**What works:** Applications can opt into structured logging, OpenTelemetry, or
both through the same framework-redacted event contract. Each `/mcp` request
produces a bounded event containing only known protocol and capability names,
HTTP method and status, transport `outcome`, bounded `protocolOutcome`, and
duration. Transport outcome remains `finished` or `disconnected`. Protocol
outcome is `success`, `tool_error`, `protocol_error`, or `disconnected`.

The [observability HTTP tests](../tests/black-box/telemetry.test.mjs) cover two
adapters, JSON and Server-Sent Events (SSE) requests, stable order, redaction,
unknown names, adapter failures, and bounded delivery and flush. The framework
classifies outcomes at known protocol boundaries without inspecting serialized
response bodies.
OpenTelemetry records transport and protocol outcomes separately as
`emseepea.transport.outcome` and `emseepea.protocol.outcome`. The CI benchmark
compares disabled and enabled built-in OpenTelemetry adapters without an
exporter; it does not measure an adopter's exporter or log destination.

**Not supported:** A guarantee that an adopter's exporter, log store, or external
observability service receives every event.

**Why:** Em See Pea controls the bounded framework event and adapter call, not the
external destination.

**If you need it:** Qualify your chosen exporter and destination in your own
deployment, including failure and flush behaviour.

### Dependency Readiness and Shutdown Flushing

**Status: Partially implemented.**

**What works:** The server includes an optional dependency-readiness callback.
Configured observability adapters may provide a shutdown-flush callback.

Readiness uses fixed responses without dependency details. Tests cover failure,
recovery, timeouts, late callback results, cancellation, and one unfinished
dependency check at a time. An unhealthy readiness response does not disable
independent tool calls. Without a callback, readiness does not check dependencies.

Shutdown stops admission and bounds request draining separately from
observability delivery and flushing. Every adapter receives an independent
bounded flush opportunity. Tests cover forced stream closure, stalled close
hooks, flusher failures, expired budgets, and repeated close calls. See the
[operations HTTP tests](../tests/black-box/operations.test.mjs).

**Not supported:** Detailed dependency diagnostics, disabling independent tool calls
when readiness is unhealthy, forcing uncooperative callbacks to stop, or proving
delivery to an external observability service.

**Why:** Readiness and shutdown are bounded framework hooks. They do not own the
application's dependency client or external telemetry destination.

**If you need it:** Put detailed diagnostics and external delivery checks in your
application or deployment health system.

## Optional Feedback Package

**Status: Application capability, not an MCP protocol claim.**
`@emseepea/feedback` composes ordinary tools through `additionalTools`. Tests
cover bounded detailed submissions, protected append-only conversations,
client-scoped access, first-offer receipts, deadlines, cancellation, minimal
events, PostgreSQL, Firestore, and deterministic GitHub and Zendesk HTTP
contracts. Webhook tests verify authentication, validation, scoping, bounds, and
deduplicate provider changes.

GitHub and Zendesk checks do not prove behavior in a live customer account.
Provider-native assignment, categories, milestones, status automation,
notifications, and email require deployment-specific qualification. Feedback
performance is not claimed. See the
[`@emseepea/feedback` guide](../packages/feedback/README.md).

## Why Every Optional Capability Is Not Claimed

Em See Pea fully implements and verifies the behaviour labelled that way on
this page. It does not claim every optional MCP capability. In particular, it
does not implement list-change notifications or generic extension-notification
registration.

The full active server-surface claim stays withdrawn until a fresh comparison
with the pinned public specification proves that this page lists every active
server rule. Every partially implemented or not implemented row must then have
exact tests from clean checkouts with two independent MCP clients.

## How Support Claims Change

Maintainers update one row at a time:

1. compare this page with every active server rule in the pinned specification
2. select the smallest independent missing standard server behaviour
3. add exact tests for that behaviour without broadening unrelated claims
4. rerun every row on this page with two independent clients from clean copies

If public MCP sources change, update this page and its tests before changing the
claim.
