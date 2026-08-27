# `@emseepea/server`

`@emseepea/server` is the Fastify-first server package for Em See Pea. It
currently provides a stateless JSON MCP `2026-07-28` endpoint, explicit public
and OAuth-protected tools, runtime schema validation, deadlines, and bounded
HTTP defaults.

The package is pre-alpha. See the
[repository README](https://github.com/windyroad/emseepea#readme) for the exact
qualified boundary and unsupported capabilities.

## Public Tool

```ts
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
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
`AbortSignal`. Object or tenant authorization and safe outbound HTTP adapters
are not yet framework capabilities.
