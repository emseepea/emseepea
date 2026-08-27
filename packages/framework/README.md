# `@emseepea/server`

`@emseepea/server` is the Fastify-first server package for Em See Pea. It
currently provides a stateless JSON MCP `2026-07-28` endpoint, explicit public
and OAuth-protected tools, checked backend adapters, runtime schema validation,
public static resources, resource templates, and prompts, deadlines, and
bounded HTTP defaults. Prompt arguments and resource-template variables may
opt into completion.

The package is pre-alpha. See the
[repository README](https://github.com/windyroad/emseepea#readme) for the exact
qualified boundary and unsupported capabilities.

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

The framework does not yet provide outbound HTTP policy, retries, credentials,
or effect handling; those remain adapter-owned and are not claimed by this
slice.

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

Resource templates are public and non-enumerating in this slice: clients
discover their URI patterns through `resources/templates/list` and read
matching URIs. Patterns accept simple `{variable}` expressions; structurally
the scheme and authority remain fixed, and each unique variable occupies a
whole path segment. Overlapping routes fail at startup instead of dispatching
by registration order.

Completion is opt-in through each definition's `complete` map. Unknown map keys
fail at startup. A handler receives the partial value plus the shared deadline,
cancellation signal, and only registered sibling arguments with string values.
Its string candidates are validated, limited with the complete public result,
and reduced to the protocol's first 100 values. A configured completion
capability is otherwise absent and `completion/complete` is rejected.
Completion is a public, identity-free operation even when OAuth is configured;
handlers must therefore return only suggestions safe for anonymous discovery.

Template enumeration, pagination, protection, and configurable cache hints are
not included. The official codec emits conservative cache fields for cacheable
operations.

## Protected Tool

Protected tools declare their scopes. The framework leaves `server/discover`
and `tools/list` public, verifies bearer tokens only for the selected protected
`tools/call`, checks expiry, scopes, and resource, and gives the handler a
token-free principal.

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

The adopter-supplied official SDK `OAuthTokenVerifier` must validate the token
issuer and independently bound or cancel any network I/O. Em See Pea bounds
how long its request waits, but the SDK verifier interface does not accept an
`AbortSignal`. Object or tenant authorization and framework-owned outbound HTTP
policy are not yet capabilities.
