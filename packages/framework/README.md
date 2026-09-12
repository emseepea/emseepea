# `@emseepea/server`

`@emseepea/server` is the Fastify-first package for building Model Context
Protocol (MCP) `2026-07-28` servers over Streamable HTTP. Its stateless
`POST /mcp` endpoint also supports the legacy revisions `2025-11-25`,
`2025-06-18`, `2025-03-26`, `2024-11-05`, and `2024-10-07`. It does not add
legacy sessions, GET streams, replay, or resumption.

It checks data when requests enter and leave the server. It supports public and
protected tools, resources, prompts, and completions, request time limits, and
bounded progress updates. Direct tools,
resources, and prompts can ask capable clients for more information. Prompt
arguments and resource fields may also offer suggestions.

The package is pre-alpha. See the
[repository README](https://github.com/emseepea/emseepea#readme) for what the
package supports and what it does not support.

## Public Tool

```ts
import { createEmseepea, defineMappedTool, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const outputSchema = z.object({
  name: z.string().describe("Name of the pea variety."),
  peaType: z.enum(["shelling", "snap"])
    .describe("Whether the variety is grown for shelled peas or edible pods."),
  growthHabit: z.enum(["bush", "climbing"])
    .describe("Whether the plant grows as a bush or climbing vine."),
  daysToMaturity: z.number().int().positive()
    .describe("Approximate days from sowing until the first harvest."),
});

const getPeaVariety = defineTool({
  name: "get-pea-variety",
  access: "public",
  description: "Get the type, growth habit, and maturity time for one pea variety.",
  inputSchema: z.object({
    name: z.string().describe("Pea variety to look up."),
  }),
  outputSchema,
  handler: ({ name }) => ({
    data: {
      name,
      peaType: "snap" as const,
      growthHabit: "climbing" as const,
      daysToMaturity: 70,
    },
  }),
});

const app = createEmseepea({ name: "pea-guide", version: "1.0.0", tools: [getPeaVariety] });
await serveEmseepea(app);
```

Describe each public input and output property in terms useful to a model. Em
See Pea includes Zod `.describe()` text in the MCP tool schema sent to clients.

The handler returns structured data. Em See Pea validates it, sends it as MCP
`structuredContent`, and serializes the same data as JSON text for clients that
do not consume structured content. Add `text` only when a client genuinely
needs a separate human-readable representation.

## Discover Capability Modules at Startup

Explicit registration still works. If you prefer one file per capability, put
modules in a directory and discover them before `createEmseepea`:

```ts
import { createEmseepea, discoverCapabilities, serveEmseepea } from "@emseepea/server";

const capabilities = await discoverCapabilities(new URL("./capabilities/", import.meta.url));
const app = createEmseepea({
  name: "pea-guide",
  version: "1.0.0",
  ...capabilities,
});

await serveEmseepea(app);
```

Capability files must be named for their public MCP kind and name:

- `tool.get-pea-variety.ts`
- `resource.getting-started.ts`
- `prompt.growing-guide.ts`

Each file exports only a default factory. The factory returns a value from
`defineTool`, `defineStreamingTool`, `defineMappedTool`, `defineResource`,
`defineResourceTemplate`, or `definePrompt`. The declared capability name must
match the filename.

```ts
import { defineTool, type CapabilityModuleFactory } from "@emseepea/server";
import { z } from "zod";

export default (() => defineTool({
  name: "get-pea-variety",
  access: "public",
  description: "Get one pea variety.",
  inputSchema: z.object({
    name: z.string().describe("Pea variety to look up."),
  }),
  outputSchema: z.object({
    name: z.string().describe("Name of the pea variety."),
  }),
  handler: ({ name }) => ({ data: { name } }),
})) satisfies CapabilityModuleFactory;
```

Discovery reads one local file URL, ignores unrelated files, sorts matching
files deterministically, rejects malformed names and duplicates, and builds the
same immutable registries as explicit arrays. It runs once before serving; it
does not watch files or change the server catalogue at runtime.

Keep TypeScript source and emitted JavaScript in separate directories, as the
starters do with `src/` and `dist/`. Using a URL relative to the running server
module discovers source in a source runner or JavaScript in a built project.
If both forms for one capability are in the same directory, discovery rejects
the duplicate instead of choosing one.

## Retire a Capability Safely

Set `discoverable: false` on a tool, resource, resource template, or prompt to
remove it from MCP list discovery while keeping direct calls available under
its existing access policy:

```ts
const legacyLookup = defineTool({
  name: "legacy-pea-lookup",
  access: "public",
  discoverable: false,
  description: "Look up one pea variety for clients migrating to the replacement tool.",
  inputSchema: z.object({ name: z.string() }),
  outputSchema,
  handler: ({ name }) => ({ data: lookupVariety(name) }),
});
```

Omitting `discoverable` is equivalent to `discoverable: true`. Suppression is
static for that server version and works the same for explicitly registered and
filesystem-discovered capabilities. It is a compatibility mechanism, not an
authorization or secrecy control: clients that already know the name or URI can
still call the capability.

For a marketplace retirement, first publish the replacement while the old
capability remains visible. Next submit and publish a version with the old
capability hidden but callable. Remove it only after that hidden version is the
supported marketplace version.

## Register HTTP Route Modules at Startup

Keep page and asset handlers out of the server entrypoint by putting each route
in its own file:

```ts
import { createEmseepea, registerRoutes, serveEmseepea } from "@emseepea/server";

const app = createEmseepea({ name: "pea-guide", version: "1.0.0" });
await registerRoutes(app, new URL("./routes/", import.meta.url));
await serveEmseepea(app);
```

The filename supplies the HTTP method and one root-level path:

- `get.index.ts` registers `GET /`.
- `post.index.ts` registers `POST /`.
- `get.emseepea.css.ts` registers `GET /emseepea.css`.

Supported filename methods are `get`, `post`, `put`, `patch`, `delete`, and
`options`.

Each route file exports only one default Fastify-compatible handler. Import the
handler type from Em See Pea so a generated project does not need a direct
Fastify dependency:

```ts
import type { HttpRouteHandler } from "@emseepea/server";

export default (async (_request, reply) => {
  await reply.type("text/plain; charset=utf-8").send("Peas are ready.\n");
}) satisfies HttpRouteHandler;
```

`registerRoutes` reads one local directory once, sorts matching files, and
rejects malformed names, duplicate method and path pairs, non-files, and route
modules with unsupported exports. Unrelated helper files are ignored. Keep
source and emitted files in separate directories so the same route is not
discovered twice.

This is optional. Direct `app.get()`, `app.post()`, and other Fastify route
registration continue to work. Use direct registration for routes that do not
fit the file convention.

## Authentication and Observability

Authentication and observability are optional extensions. The application
factory in every initializer accepts the same `EmseepeaExtensions` type, so an
API, database, SOAP, or UI server can add either feature without changing
templates.

The same extension type accepts `additionalTools`. Use it to compose optional
capability packages without replacing the initializer's own discovered tool
catalogue:

```ts
const app = await createToolServer({
  additionalTools: feedbackTools,
  authentication,
  observability,
});
```

Duplicate public names are rejected before the server listens. See the
[`@emseepea/feedback` guide](../feedback/README.md) for a complete optional
capability example.

Every capability declares an access policy. Public discovery is the default,
including when protected capabilities exist. The framework authenticates only
protected calls in this mode.

Set `authentication.discovery` to `"protected"` only when the catalogue itself
is sensitive. Then every MCP request requires a valid token and list responses
contain only capabilities allowed by the principal's permissions. OAuth
discovery metadata remains public in both modes.

```ts
const app = createEmseepea({
  name: "seed-inventory",
  version: "1.0.0",
  tools: [lookup],
  authentication: {
    discovery: "public",
    verifier,
    metadata: {
      resourceServerUrl: new URL("https://api.example/mcp"),
      scopesSupported: ["seeds:read"],
      oauthMetadata,
    },
  },
  observability: [
    structuredLogging("application-log", (event) => logger.info(event)),
    openTelemetry(),
  ],
});
```

The verifier must validate the token issuer, audience, expiry, intended
resource, and permissions. The framework gives protected handlers only a
normalized principal with `clientId`, `permissions`, and optional `resource`.
It never gives them the token or raw provider claims. Authentication and
authorization finish before handlers, availability checks, completion
callbacks, or backend calls.

Each observability adapter receives one immutable, framework-created event per
MCP request. Its bounded fields are the known MCP method, known capability name
when applicable, HTTP method and status, completion outcome, and duration.

Adapters never receive request or response objects, bodies, headers, arguments,
results, tokens, URLs, raw errors, or provider claims. Adapter failures do not
change protocol results.

Configure OpenTelemetry providers before calling `openTelemetry()`. Em See Pea
does not choose an exporter or send data to a service. To flush a provider,
include its bounded `flush` function on your adapter. `running.close()` gives
each adapter an independent flush opportunity. Set
`observabilityFlushTimeoutMs` in `serveEmseepea` to change the 1,000 millisecond
default, up to 60,000 milliseconds.

## Report Dependency Readiness

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

## Describe What Clients Can Show

Applications can give servers, tools, resources, reusable resource addresses,
and prompts a human-friendly title, description, and icons. A server can also
provide its website address. Tools can say whether they only read data and
whether they contact services outside the application:

```ts
const getPeaVariety = defineTool({
  name: "get-pea-variety",
  title: "Get pea variety",
  access: "public",
  description: "Get the recorded details for one pea variety.",
  icons: [{ src: "https://garden.example/icons/pea.png", mimeType: "image/png" }],
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: z.object({ name: z.string() }),
  outputSchema,
  handler,
});
```

Resources may also include their known byte size and hints about their intended
audience and importance. Use `_meta` for application-specific public details.

Em See Pea checks this metadata when the application starts and copies it, so
later changes to the original objects have no effect. Tool annotations are
hints for clients. They do not prove that a tool is safe, grant permission, or
replace authentication and authorization checks.

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

This option pages the registered catalogue metadata. It does not page through
application records or expand a resource template.

```ts
const app = createEmseepea({
  name: "pea-guide",
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

This example asks the person for a pea-growing preference:

```ts
import { acceptedContent, defineTool, inputRequired } from "@emseepea/server";
import { z } from "zod";

const preference = z.object({ support: z.enum(["stakes", "trellis"]) });

const chooseSupport = defineTool({
  name: "choose-support",
  access: "public",
  description: "Ask which support a person prefers for one climbing pea.",
  inputSchema: z.object({ variety: z.string() }),
  outputSchema: z.object({ variety: z.string(), support: z.string() }),
  handler: ({ variety }, context) => {
    const answer = acceptedContent(context.inputResponses, "preference", preference);
    if (!answer) {
      return inputRequired({
        inputRequests: {
          preference: inputRequired.elicit({
            message: `Which support do you prefer for ${variety}?`,
            requestedSchema: preference,
          }),
        },
      });
    }
    return { data: { variety, support: answer.support } };
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
time limit, cancellation, safe-error handling, and access policy to every
round.

### Ask for Client Workspace Roots

Set `clientRoots: {}` on `createEmseepea` to let direct tools, resources,
resource templates, and prompts ask the client for its file or directory roots.
The client must declare support for roots on each request. Roots are deprecated
in MCP 2026-07-28 but remain part of that protocol version.

Use `inputRequired.roots()` to request them and `rootsResponse` to read them:

```ts
import { rootsResponse, inputRequired } from "@emseepea/server";

const roots = rootsResponse(context.inputResponses, "workspace");
if (roots === undefined) {
  return inputRequired({ inputRequests: { workspace: inputRequired.roots() } });
}
// An empty array is a valid answer. Each root has a file:// URI and optional name.
```

The framework validates roots before calling the handler. `rootsResponse`
returns an immutable array, returns `undefined` for a missing key, and throws
if that key contains another kind of answer. The handler chooses the expected
key. Without saved application state, the framework cannot prove that an answer
belongs to an earlier request.

`clientRoots.maxRoots` defaults to 100 and accepts a positive safe integer.
The existing `maxRequestBytes` setting limits the whole request, including
root names, URIs, and metadata. Every protected round checks authorization.
Roots grant no file access or permissions. Em See Pea never opens these paths
or automatically logs them. Mapped and streaming tools do not request roots.

### Use Model-Provider APIs Instead of MCP Sampling

Em See Pea intentionally does not support the deprecated MCP 2026-07-28
`sampling/createMessage` feature. The framework exposes no Sampling request
helper or response accessor, and rejects hand-built Sampling requests at the
checked client-input boundary. Applications that need model generation should
integrate directly with their chosen model provider and own the credentials,
model selection, cost controls, approval, and data-disclosure policy.

### Carry Signed Request State

Stateful requests are opt-in. Configure one signing key for every process that
may receive a later round:

```ts
const state = z.object({ page: z.number().int().nonnegative() });
const requestStateKey = process.env.MCP_REQUEST_STATE_KEY;
if (!requestStateKey) throw new Error("MCP_REQUEST_STATE_KEY is required");

const nextPage = defineTool({
  name: "next-page",
  access: "public",
  description: "Continue from signed request state.",
  inputSchema: z.object({}),
  outputSchema: state,
  async handler(_input, context) {
    const resumed = state.safeParse(context.requestState);
    if (resumed.success) return { data: resumed.data };
    if (!context.mintRequestState) throw new Error("Request state is not configured");
    return inputRequired({
      requestState: await context.mintRequestState({ page: 1 }),
    });
  },
});

const app = createEmseepea({
  name: "stateful-server",
  version: "1.0.0",
  tools: [nextPage],
  requestState: {
    key: requestStateKey, // At least 32 UTF-8 bytes.
    ttlSeconds: 600,
    maxBytes: 4 * 1024,
  },
});
```

The installed MCP SDK signs and expires the state. Em See Pea also binds it to
the method and capability, and to the authenticated principal for protected
capabilities. Verification happens before the handler runs. The handler sees
decoded `unknown` data and must validate it before use.

Signed state is readable, not encrypted. Do not put secrets, credentials,
private backend data, or effect authority in it. A valid state value can be
replayed until it expires, so applications still own effect idempotency where
their use case requires it. Mapped tools and progress-reporting tools remain on
their existing checked paths and cannot request more client input.

## Mapped Backend Tool

`defineMappedTool` validates the public input, mapped backend command, backend
result, and public output. The adapter receives only its validated command, the
request cancellation signal, and the shared deadline.

Use `defineTool` instead when the backend already accepts the public input and
returns the public output. `defineMappedTool` is for a real contract boundary,
not an identity mapping.

Preserve useful backend concepts and values by default. Select public-safe
fields explicitly and validate the public and backend boundaries separately,
but do not maintain a second list of values just to rename it. Map values only
for transport compatibility, security, redaction, aggregation, or genuine model
comprehension.

Prefer an open, bounded schema when the backend can add valid values
independently.

```ts
const inputSchema = z.object({
  name: z.string().max(200).describe("Pea taxon to look up."),
});
const backendInputSchema = z.object({ search: z.string().max(200) });
const backendTaxon = z.object({
  id: z.number().int().positive().describe("Provider identifier for the taxon."),
  name: z.string().max(200).describe("Scientific name of the taxon."),
  rank: z.string().max(40).describe("Taxonomic rank reported by the provider."),
  observations_count: z.number().int().nonnegative()
    .describe("Recorded observations, not an estimate of the wild population."),
});
const outputSchema = backendTaxon.extend({
  source: z.literal("catalogue-service").describe("Data provider for this result."),
});
const backendOutputSchema = z.object({
  record: backendTaxon,
});

const getPeaTaxon = defineMappedTool({
  name: "get-pea-taxon",
  access: "public",
  description: "Get a pea taxon from the catalogue service.",
  inputSchema,
  outputSchema,
  backendInputSchema,
  backendOutputSchema,
  mapInput: ({ name }) => ({ search: name }),
  adapter: async (command, { signal }) => backend.findTaxon(command, { signal }),
  mapOutput: ({ record }) => ({
    data: { ...record, source: "catalogue-service" as const },
  }),
});
```

For a read-only JSON API that does not require backend credentials, use the narrow HTTP
client from `@emseepea/server/http`:

```ts
import { createJsonHttpClient } from "@emseepea/server/http";

const plantApi = createJsonHttpClient({ origin: "https://plants.example" });
const result = await plantApi.get({
  pathname: "/api/taxa",
  searchParams: { q: "pea", limit: "5" },
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
  id: "pea-planting-plan",
  heading: "Preview a pea planting plan",
  legend: "Planting plan options",
  submitLabel: "Preview plan",
  fields: [{
    kind: "text",
    id: "title",
    name: "title",
    label: "Plan title",
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

const germination = defineStreamingTool({
  name: "run-germination-trial",
  access: "public",
  description: "Run one sample pea germination trial.",
  inputSchema: z.object({ tray: z.string() }),
  outputSchema: z.object({ status: z.literal("complete") }),
  async handler(_input, { reportProgress, signal }) {
    signal.throwIfAborted();
    await reportProgress({ progress: 1, total: 1, message: "sprout" });
    return { data: { status: "complete" } };
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

Public and protected tools can also report progress behind a trusted HTTPS
proxy. The framework authenticates and authorizes a protected call before it
starts the event stream or calls application code.

Using the `germination` tool above, configure the proxy's exact address and the public
host and origin your clients use:

```ts
const app = createEmseepea({
  name: "pea-guide",
  version: "1.0.0",
  tools: [germination],
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
- saved sessions or replay
- recovery after reconnecting
- slowing the producer when a client cannot keep up

See the [progress coverage and tested proxy setup](../../docs/protocol-coverage.md#progress-updates)
for the current checks and their limits.

## Client-Visible Request Logs

See [how to enable bounded request logs](https://emseepea.github.io/emseepea/getting-started/#send-logs-to-the-calling-client).
This deprecated client-visible channel is separate from server-operator
observability.

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

const guideUri = "guide://peas/getting-started";

const guide = defineResource({
  name: "getting-started",
  uri: guideUri,
  mimeType: "text/markdown",
  cacheHint: { ttlMs: 30_000 },
  handler: () => ({ contents: [{ uri: guideUri, text: "# Grow peas safely" }] }),
});

const methodGuide = defineResourceTemplate({
  name: "method-guide",
  uriTemplate: "guide://peas/planting/{method}",
  mimeType: "text/markdown",
  complete: {
    method: (value) => ["container", "raised-bed"].filter((method) => method.startsWith(value)),
  },
  handler: ({ uri, variables }) => ({
    contents: [{ uri, text: `# ${String(variables.method)}` }],
  }),
});

const growing = definePrompt({
  name: "growing-guide",
  argsSchema: z.object({
    topic: z.string().min(1).describe("Pea-growing topic to explain."),
  }),
  complete: {
    topic: (value) => ["sowing-depth", "plant-spacing"].filter((topic) => topic.startsWith(value)),
  },
  handler: ({ topic }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Explain ${topic}.` } }],
  }),
});

const app = createEmseepea({
  name: "peas",
  version: "1.0.0",
  resources: [guide, methodGuide],
  prompts: [growing],
  cacheHints: {
    "resources/list": { ttlMs: 60_000, cacheScope: "public" },
    "resources/read": { ttlMs: 5_000, cacheScope: "private" },
  },
});
```

The `resources` definitions populate the catalogues of static resources and
resource templates. `resources/list` and `resources/templates/list` do not
query application records or return resource contents. See
[when to provide a list or search tool](https://emseepea.github.io/emseepea/examples/#share-reference-material-and-prompts).

To let clients watch a resource they already know about, opt into bounded
resource-update subscriptions and publish its registered URI after its content
changes:

```ts
import { notifyResourceUpdated } from "@emseepea/server";

const app = createEmseepea({
  name: "peas",
  version: "1.0.0",
  resources: [guide, methodGuide],
  resourceSubscriptions: {},
});

notifyResourceUpdated(app, "guide://peas/getting-started");
```

Each `subscriptions/listen` request accepts one static resource URI or one
concrete URI matching a registered template. The framework authenticates
access to a protected resource before opening the stream.

The default limits are 16 active streams, 256 events, 8 KiB per event, a
512-byte URI, and a 30-second lifetime. Configure them with
`resourceSubscriptions`. Streams and notifications are process-local, with no
replay or reconnect recovery. List-change subscriptions are not supported.

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

Completion inherits the access policy of its prompt or resource template.
With public discovery, return suggestions that are safe to expose in that
catalogue. With protected discovery, the framework authenticates before the
completion callback runs.

Em See Pea does not enumerate every concrete address that could match a
resource template or permit unbounded catalogue pages. Applications provide a
purpose-built search or list tool when clients need concrete records, then the
client uses `resources/read` for the selected URI.

## Tool That Requires Sign-In

Protected capabilities declare their permissions. Discovery remains public by
default. Set `authentication.discovery` to `"protected"` when capability names
and schemas must also be hidden from principals without permission.

```ts
const lookup = defineTool({
  name: "lookup-private-seed-lot",
  access: "protected",
  requiredScopes: ["seeds:read"],
  description: "Look up a private pea seed lot.",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ id: z.string(), clientId: z.string() }),
  handler: ({ id }, { principal }) => ({
    text: id,
    data: { id, clientId: principal.clientId },
  }),
});

const app = createEmseepea({
  name: "seed-inventory",
  version: "1.0.0",
  tools: [lookup],
  authentication: {
    discovery: "protected",
    verifier,
    metadata: {
      resourceServerUrl: new URL("https://api.example/mcp"),
      scopesSupported: ["seeds:read"],
      oauthMetadata,
    },
  },
});
```

The application's token checker must verify who issued the token and stop its
own slow network or file work. Em See Pea limits how long the request waits.
The official MCP library cannot pass a cancellation signal to the checker.

The application must still decide whether the principal may access each record.

The HTTP client described above is only for public, read-only JSON APIs. The
application remains responsible for backend requests that use credentials.
