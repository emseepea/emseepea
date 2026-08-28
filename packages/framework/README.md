# `@emseepea/server`

`@emseepea/server` is the Fastify-first package for building Model Context
Protocol (MCP) `2026-07-28` servers over Streamable HTTP.

It checks data when requests enter and leave the server. It supports public
tools, tools that require sign-in, public resources and prompts, request time
limits, and bounded progress updates for local examples. Prompt arguments and
resource fields may also offer suggestions.

The package is pre-alpha. See the
[repository README](https://github.com/windyroad/emseepea#readme) for what the
package supports and what it does not support.

## Public Tool

```ts
import { createEmseepea, defineMappedTool, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const lookup = defineTool({
  name: "lookup-bean",
  access: "public",
  description: "Look up a bean.",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ id: z.string() }),
  handler: ({ id }) => ({ text: id, data: { id } }),
});

const app = createEmseepea({ name: "beans", version: "1.0.0", tools: [lookup] });
await serveEmseepea(app);
```

## Mapped Backend Tool

`defineMappedTool` validates the public input, mapped backend command, backend
result, and public output. The adapter receives only its validated command, the
request cancellation signal, and the shared deadline.

Use `defineTool` instead when the backend already accepts the public input and
returns the public output. `defineMappedTool` is for a real contract boundary,
not an identity mapping.

```ts
const lookup = defineMappedTool({
  name: "lookup-bean",
  access: "public",
  description: "Look up a bean.",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ id: z.string() }),
  backendInputSchema: z.object({ key: z.string() }),
  backendOutputSchema: z.object({ record: z.object({ id: z.string() }) }),
  mapInput: ({ id }) => ({ key: id }),
  adapter: async ({ key }, { signal }) => backend.lookup(key, { signal }),
  mapOutput: ({ record }) => ({ text: record.id, data: record }),
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
import { defineStreamingTool } from "@emseepea/server";

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
payloads, measured before protocol encoding. Set
`maxProgressEvents` and `maxProgressEventBytes` on `createEmseepea` to change
those positive bounds. The reporter closes with the tool call, heartbeats are
disabled, and invalid, oversized, late, or extra updates are rejected.
Streaming tools start only for local examples. They do not yet support:

- long-running streams opened with GET
- saved sessions, replay, or subscriptions
- proxy servers or recovery after reconnecting
- slowing the producer when a client cannot keep up
- more than one server instance

## Public Resources and Prompts

Static resources and prompts are public operations. Their handlers receive only
the shared deadline and cancellation signal. The framework validates prompt
arguments and both result types before emission. `operationTimeoutMs` bounds
tool calls, resource reads, and prompt gets. `maxApplicationResultBytes` bounds
each validated handler result before SDK encoding; SDK metadata, protocol
envelopes, discovery, and catalogues are outside that limit. The settings
default to 30 seconds and one mebibyte respectively.

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
});
```

Resource templates advertise an address pattern rather than listing every
possible address. Clients list the patterns, then read an address that matches
one. Each `{variable}` fills one complete path segment. The scheme and host
cannot change. Conflicting patterns stop the server at startup.

Suggestions are optional. When enabled, a handler receives the partial text,
the request time limit, cancellation, and registered string arguments. Em See
Pea checks the returned suggestions and keeps at most the first 100.

Suggestions are public even when some tools require sign-in. Return only text
that is safe for anyone to discover.

Listing every matching address, large result pages, sign-in for resources, and
custom caching are not included yet.

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
own slow network or file work. Em See Pea limits how long the request waits, but
the checker cannot receive a cancellation signal from the official MCP library.
The application must also decide whether the signed-in person may access each
record. The HTTP client described above is only for public, read-only JSON APIs;
credentialed backend requests remain the application's responsibility.
