# `@emseepea/server`

`@emseepea/server` is the Fastify-first package for building Model Context
Protocol (MCP) `2026-07-28` servers over Streamable HTTP.

It checks data when requests enter and leave the server. It supports public
tools, tools that require sign-in, public resources and prompts, request time
limits, and bounded progress updates. Direct tools,
resources, and prompts can ask capable clients for more information. Prompt
arguments and resource fields may also offer suggestions.

The package is pre-alpha. See the
[repository README](https://github.com/windyroad/emseepea#readme) for what the
package supports and what it does not support.

## Public Tool

```ts
import { createEmseepea, defineMappedTool, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const beanDetails = z.object({
  name: z.string(),
  origin: z.string(),
  variety: z.string(),
  process: z.enum(["washed", "natural"]),
  roast: z.enum(["light", "medium", "dark"]),
  tastingNotes: z.array(z.string()),
});

const getBeanDetails = defineTool({
  name: "get-bean-details",
  access: "public",
  description: "Get the origin, variety, process, roast, and tasting notes for one coffee.",
  inputSchema: z.object({ name: z.string() }),
  outputSchema: beanDetails,
  handler: ({ name }) => {
    const data = {
      name,
      origin: "Sample Highlands",
      variety: "Bourbon",
      process: "natural" as const,
      roast: "medium" as const,
      tastingNotes: ["berry", "cocoa"],
    };
    return { text: `${name} is a medium-roast natural Bourbon from Sample Highlands.`, data };
  },
});

const app = createEmseepea({ name: "coffee-guide", version: "1.0.0", tools: [getBeanDetails] });
await serveEmseepea(app);
```

## Measure Requests

Available in this checkout; not yet published to npm.

Set `telemetry: true` in `createEmseepea` to record request traces, counts, and
response times through OpenTelemetry. Leave it out to disable these measurements.

Configure your OpenTelemetry providers and context manager before creating the
app. Em See Pea does not choose an exporter or send data to a service.

### What Gets Measured

Each trace covers one `/mcp` request through response completion or
disconnection, including progress updates. Measurements report:

- the HTTP method and status
- the known MCP method, or `_OTHER` for unknown names
- whether the response finished or disconnected

An HTTP 200 response can still contain a tool error. These measurements describe
the response, not whether the tool achieved its task.

### What Stays Out

The framework does not attach tool names, request data, tokens, URLs, or error
messages. It preserves a valid active parent trace identity, but drops baggage
and other context data. It does not read trace headers itself.

### Current Limits

SDK host and origin rejections happen before this measurement starts.
Ordinary telemetry API and exporter failures do not change tool results.
An adopter exporter that blocks the process or throws outside the telemetry
call is not isolated.

Structured logs are not included yet.

## Report Dependency Readiness

Available in this checkout; not yet published to npm.

Pass a `readiness` callback to `createEmseepea` to check the dependencies your
server needs. The callback receives `{ signal }` and must return `true` only
when those dependencies are ready. It may return a promise.

`GET /readyz` returns:

- HTTP 200 and `ready` when the check succeeds
- HTTP 503 and `not ready` when it fails, throws, or takes too long

The reply never includes dependency details or error messages. It is not cached.
`GET /healthz` continues to report that the process is alive, not that its
dependencies work. Without a callback, readiness does not check dependencies.

Set `readinessTimeoutMs` to limit the check. It defaults to 1,000 milliseconds
and accepts whole numbers from 1 to 60,000. A timeout or shutdown signals
cancellation. Only one dependency check can remain unfinished at a time; if it
ignores cancellation, later probes return not-ready until it settles.

Readiness reports health for a load balancer or monitoring system. It does not
block MCP calls itself. Tool handlers must still handle an unavailable backend.

## Flush Measurements on Shutdown

Available in this checkout; not yet published to npm.

Pass `flushTelemetry` to `serveEmseepea` to flush your OpenTelemetry providers
when the returned server's `close()` method runs. The callback receives
`{ signal }`; it can call your providers' `forceFlush()` methods. Calling the
Fastify app's `close()` directly does not run this callback.

Shutdown uses two time limits:

- `shutdownTimeoutMs`: finish existing requests, then close remaining
  connections. The default is 5,000 milliseconds.
- `telemetryFlushTimeoutMs`: wait for the final request measurements, then flush.
  The default is 1,000 milliseconds; the allowed range is 1 to 60,000.

The total waiting budget is the sum of those limits. The second limit applies
only when you provide `flushTelemetry`. If final measurements are not ready in
time, flushing is skipped. Repeated `close()` calls share the same work.

Flushing is best-effort. Its errors do not change tool responses, and completion
of `close()` does not prove that an exporter delivered data. Callbacks that block
JavaScript or ignore cancellation cannot be forcibly stopped by the framework.

## Describe What Clients Can Show

Applications can give servers, tools, resources, reusable resource addresses,
and prompts a human-friendly title, description, and icons. A server can also
provide its website address. Tools can say whether they only read data and
whether they contact services outside the application:

```ts
const getBeanDetails = defineTool({
  name: "get-bean-details",
  title: "Get bean details",
  access: "public",
  description: "Get the recorded details for one coffee.",
  icons: [{ src: "https://coffee.example/icons/bean.png", mimeType: "image/png" }],
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: z.object({ name: z.string() }),
  outputSchema: beanDetails,
  handler,
});
```

Resources may also include their known byte size and hints about their intended
audience and importance. Use `_meta` for application-specific public details.

Em See Pea checks this metadata when the application starts and copies it, so
later changes to the original objects have no effect. Tool annotations are
hints for clients. They do not prove that a tool is safe, grant permission, or
replace sign-in and authorization checks.

## Route with a Tool Argument

A proxy can route a request using a checked tool argument without reading the
JSON body. Mark a string, integer, or boolean property with `x-mcp-header`:

```ts
const inputSchema = z.object({
  region: z.string().meta({ "x-mcp-header": "Region" }),
});
```

Compatible clients send the same value as `Mcp-Param-Region`. The tool still
receives and checks `region` normally. The server rejects a missing or
different header before the tool runs.

This header is a copy of tool input. It does not identify a person, prove that
they signed in, grant permission, or protect a secret.

## Bound Large Catalogues

Split long tool, resource, resource-address, and prompt lists into pages by
adding one option to the server:

```ts
const app = createEmseepea({
  name: "coffee-guide",
  version: "1.0.0",
  tools,
  listPagination: { pageSize: 50, maxPageBytes: 256 * 1024 },
});
```

`pageSize` must be between 1 and 100. `maxPageBytes` defaults to one mebibyte and
stops a page earlier when its public catalogue details would be too large. The
server stops at startup if one item cannot fit.

Clients receive an opaque cursor for the next page. Identical server instances
accept the same cursor. Changing the catalogue or either limit makes old
cursors invalid. Cursors select public catalogue pages; they do not identify a
person or grant permission. Omit `listPagination` to keep one-page lists.

## Ask the Client for More Information

Application authors can create a direct tool, resource, resource address
pattern, or prompt that pauses and asks a capable client for more information.
The client answers by making a fresh request, and the handler runs again with
those answers in its context.

This example asks the person for a coffee preference:

```ts
import { acceptedContent, defineTool, inputRequired } from "@emseepea/server";
import { z } from "zod";

const preference = z.object({ roast: z.enum(["light", "medium", "dark"]) });

const chooseRoast = defineTool({
  name: "choose-roast",
  access: "public",
  description: "Ask which roast a person prefers for one coffee.",
  inputSchema: z.object({ coffee: z.string() }),
  outputSchema: z.object({ coffee: z.string(), roast: z.string() }),
  handler: ({ coffee }, context) => {
    const answer = acceptedContent(context.inputResponses, "preference", preference);
    if (!answer) {
      return inputRequired({
        inputRequests: {
          preference: inputRequired.elicit({
            message: `Which roast do you prefer for ${coffee}?`,
            requestedSchema: preference,
          }),
        },
      });
    }
    return {
      text: `${answer.roast} roast selected for ${coffee}`,
      data: { coffee, roast: answer.roast },
    };
  },
});
```

Use `acceptedContent` with the same schema that described the form. Client
answers are untrusted even when they have the expected wire shape. Use
`inputResponse` when the handler must distinguish acceptance, refusal, and
cancellation.

A client answer supplies information. It is not proof of identity or permission
to change data. Authorize any effect through the application's normal security
boundary.

The client must advertise elicitation for form input or URL-mode elicitation,
where the client opens a URL. Em See Pea applies the normal result-size limit,
time limit, cancellation, safe-error handling, and sign-in policy to every
round.

This release supports stateless requests only. It rejects opaque
`requestState`. Mapped tools and progress-reporting tools return through their
existing checked paths and cannot request more client input.

## Mapped Backend Tool

`defineMappedTool` validates the public input, mapped backend command, backend
result, and public output. The adapter receives only its validated command, the
request cancellation signal, and the shared deadline.

Use `defineTool` instead when the backend already accepts the public input and
returns the public output. `defineMappedTool` is for a real contract boundary,
not an identity mapping.

```ts
const backendCommand = z.object({ search: z.string() });
const backendResult = z.object({
  record: z.object({
    name: z.string(),
    country: z.string(),
    variety: z.string(),
    processCode: z.enum(["W", "N"]),
    roastLevel: z.enum(["light", "medium", "dark"]),
    flavourNotes: z.array(z.string()),
  }),
});

const getBeanDetails = defineMappedTool({
  name: "get-bean-details",
  access: "public",
  description: "Get clear coffee details from the catalogue service.",
  inputSchema: z.object({ name: z.string() }),
  outputSchema: beanDetails,
  backendInputSchema: backendCommand,
  backendOutputSchema: backendResult,
  mapInput: ({ name }) => ({ search: name }),
  adapter: async (command, { signal }) => backend.findCoffee(command, { signal }),
  mapOutput: ({ record }) => {
    const data = {
      name: record.name,
      origin: record.country,
      variety: record.variety,
      process: record.processCode === "W" ? "washed" as const : "natural" as const,
      roast: record.roastLevel,
      tastingNotes: record.flavourNotes,
    };
    return { text: `${data.name} is a ${data.roast}-roast ${data.process} coffee from ${data.origin}.`, data };
  },
});
```

For a read-only JSON API that does not require sign-in, use the narrow HTTP
client from `@emseepea/server/http`:

```ts
import { createJsonHttpClient } from "@emseepea/server/http";

const coffeeApi = createJsonHttpClient({ origin: "https://coffee.example" });
const result = await coffeeApi.get({
  pathname: "/api/coffees",
  searchParams: { q: "ethiopia", limit: "5" },
  signal,
  deadlineMs,
});
```

The client connects only to the configured HTTPS site. It blocks local and
private network addresses, redirects, compressed responses, oversized data,
and responses that are not JSON. It does not send credentials, retry requests,
cache data, accept custom headers, or change data. The result is `unknown` so a
mapped tool must check it with its backend output schema before using it.

A mapped tool may add an `isAvailable` function when its backend can be
temporarily unavailable. The check receives the same cancellation signal and
deadline as the adapter. It must be quick and must not change data.

An unavailable tool stays in `tools/list`, but calls to it return a generic
failure before mapping or backend work begins. Other tools and `/readyz` keep
working because `/readyz` reports whether the server process is ready, not
whether every application backend is available.

## Form Presentation

Use `defineElicitationView` to validate form display data and
`renderElicitationForm` to create a native HTML fragment. The host application
still owns its page, request handling, authorization, and effects.

```ts
import { defineElicitationView, renderElicitationForm } from "@emseepea/server";

const view = defineElicitationView({
  id: "bean-report",
  heading: "Preview a bean report",
  legend: "Report options",
  submitLabel: "Preview report",
  fields: [{
    kind: "text",
    id: "title",
    name: "title",
    label: "Report title",
    required: true,
  }],
  state: { kind: "ready", focusTarget: "none" },
});

const fragment = renderElicitationForm(view, { headingLevel: 2 });
```

The schema accepts presentation data only. It excludes raw HTML, destinations,
credentials, backend state, and permission to perform an action. Rendering a
form never means that an action was authorized or completed.

## Streaming Progress

Use `defineStreamingTool` only when a tool has meaningful progress to report.
It checks the input, progress updates, and final result. If the client asks for
progress, the official MCP library sends progress events over the same POST
request. Otherwise the call returns one JSON response.

```ts
import { createEmseepea, defineStreamingTool } from "@emseepea/server";
import { z } from "zod";

const roast = defineStreamingTool({
  name: "roast-batch",
  access: "public",
  description: "Run one sample roast batch.",
  inputSchema: z.object({ batch: z.string() }),
  outputSchema: z.object({ status: z.literal("complete") }),
  async handler(_input, { reportProgress, signal }) {
    signal.throwIfAborted();
    await reportProgress({ progress: 1, total: 1, message: "cool" });
    return { text: "complete", data: { status: "complete" } };
  },
});
```

Progress is strictly increasing and defaults to at most 32 small notification
payloads, measured before protocol encoding.

Set `maxProgressEvents` and `maxProgressEventBytes` on `createEmseepea` to
change those positive bounds. The reporter closes with the tool call.
Heartbeats are disabled. Invalid, oversized, late, or extra updates are
rejected.

### Use Progress Behind a Proxy

In the current source, public tools can also report progress behind a trusted
HTTPS proxy. This addition is not yet in a published npm release.

Using the `roast` tool above, configure the proxy's exact address and the public
host and origin your clients use:

```ts
const app = createEmseepea({
  name: "coffee-guide",
  version: "1.0.0",
  tools: [roast],
  deployment: {
    mode: "production-behind-proxy",
    trustedProxyAddresses: ["10.0.0.10"],
    allowedAuthorities: ["mcp.example.com"],
    allowedOrigins: ["https://mcp.example.com"],
    rateLimit: { maxRequests: 100, windowMs: 60_000, maxClients: 1_000 },
  },
});
```

Replace these example addresses with yours. The server still listens locally
by default. Choose a private listening address explicitly when starting it,
and restrict network access so only your proxy can reach it.

Your proxy must replace caller-supplied forwarding headers and send:

- `X-Forwarded-Proto: https` for the original HTTPS connection
- `X-Forwarded-For` containing one client IP address, not a comma-separated chain
- `Host` matching an entry in `allowedAuthorities`

It must also forward streamed responses without buffering them.
`X-Accel-Buffering: no` asks compatible proxies not to buffer; it does not
configure your proxy for you.

Each call sends progress on its already-open HTTP response. A later call can
go to another server without pinning that client to the first server. This
does not share application state or rate limits: the configured limit applies
to each server separately.

### Limits

Progress remains limited by the event count, event size, result size, and
request deadline. Disconnecting cancels work that observes the cancellation
signal. These checks do not slow the producer to match a slow reader.

Not supported yet:

- long-running streams opened with GET
- saved sessions, replay, or subscriptions
- recovery after reconnecting
- slowing the producer when a client cannot keep up
- progress from tools requiring sign-in outside local development

See the [progress coverage and tested proxy setup](../../docs/protocol-coverage.md#progress-updates)
for the current checks and their limits.

## Public Resources and Prompts

Static resources and prompts are public operations. Their handlers receive only
the shared deadline and cancellation signal. The framework checks prompt
arguments and results before returning them.

`operationTimeoutMs` limits tool calls, resource reads, and prompt requests. It
defaults to 30 seconds.

`maxApplicationResultBytes` limits each checked handler result before MCP
encoding. It defaults to one mebibyte. The limit does not include MCP metadata,
protocol envelopes, discovery, or catalogues.

```ts
import {
  createEmseepea,
  definePrompt,
  defineResource,
  defineResourceTemplate,
} from "@emseepea/server";
import { z } from "zod";

const guideUri = "guide://coffee/getting-started";

const guide = defineResource({
  name: "getting-started",
  uri: guideUri,
  mimeType: "text/markdown",
  cacheHint: { ttlMs: 30_000 },
  handler: () => ({ contents: [{ uri: guideUri, text: "# Brew safely" }] }),
});

const methodGuide = defineResourceTemplate({
  name: "method-guide",
  uriTemplate: "guide://coffee/method/{method}",
  mimeType: "text/markdown",
  complete: {
    method: (value) => ["espresso", "pour-over"].filter((method) => method.startsWith(value)),
  },
  handler: ({ uri, variables }) => ({
    contents: [{ uri, text: `# ${String(variables.method)}` }],
  }),
});

const brew = definePrompt({
  name: "brew-guide",
  argsSchema: z.object({ topic: z.string().min(1) }),
  complete: {
    topic: (value) => ["grind-size", "water-temperature"].filter((topic) => topic.startsWith(value)),
  },
  handler: ({ topic }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Explain ${topic}.` } }],
  }),
});

const app = createEmseepea({
  name: "coffee",
  version: "1.0.0",
  resources: [guide, methodGuide],
  prompts: [brew],
  cacheHints: {
    "resources/list": { ttlMs: 60_000, cacheScope: "public" },
    "resources/read": { ttlMs: 5_000, cacheScope: "private" },
  },
});
```

## Tell Clients When They May Reuse Results

By default, clients are told not to reuse lists, discovery details, or resource
content. `cacheHints` sets a time limit in milliseconds and says whether a
shared cache may store the result.

Use `public` only when every caller receives the same non-sensitive result.
Use `private` for results that only the requesting client may keep. These
instructions do not grant access and do not make changing or personal data safe
to share.

An individual resource or reusable resource address can override either field.
In the example, `guide` overrides the time limit while its missing
`cacheScope` still comes from `cacheHints["resources/read"]`.

Cache instructions are supported for discovery, tool lists, resource lists,
reusable resource-address lists, prompt lists, and resource reads.

Resource templates advertise an address pattern rather than listing every
possible address. Clients list the patterns, then read an address that matches
one. Each `{variable}` fills one complete path segment. The scheme and host
cannot change. Conflicting patterns stop the server at startup.

Suggestions are optional. When enabled, a handler receives the partial text,
the request time limit, cancellation, and registered string arguments. Em See
Pea checks the returned suggestions and keeps at most the first 100.

Suggestions are public even when some tools require sign-in. Return only text
that is safe for anyone to discover.

Listing every matching address, catalogue pages without the bounds above, and
sign-in for resources are not included yet.

## Tool That Requires Sign-In

Tools that require sign-in declare their permissions. The framework leaves
`server/discover` and `tools/list` open to everyone. It verifies a bearer token
only when someone calls the restricted tool, then checks its expiry,
permissions, and intended server. The tool receives the caller's identity, not
the token itself.

```ts
const lookup = defineTool({
  name: "lookup-private-bean",
  access: "protected",
  requiredScopes: ["beans:read"],
  description: "Look up a private bean.",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ id: z.string(), clientId: z.string() }),
  handler: ({ id }, { principal }) => ({
    text: id,
    data: { id, clientId: principal.clientId },
  }),
});

const app = createEmseepea({
  name: "beans",
  version: "1.0.0",
  tools: [lookup],
  oauth: {
    verifier,
    metadata: {
      resourceServerUrl: new URL("https://api.example/mcp"),
      scopesSupported: ["beans:read"],
      oauthMetadata,
    },
  },
});
```

The application's token checker must verify who issued the token and stop its
own slow network or file work. Em See Pea limits how long the request waits.
The official MCP library cannot pass a cancellation signal to the checker.

The application must decide whether the signed-in person may access each
record.

The HTTP client described above is only for public, read-only JSON APIs. The
application remains responsible for backend requests that use credentials.
