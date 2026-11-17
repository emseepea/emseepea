---
title: Deploy MCP tools on Cloudflare Workers
description: Deploy a stateless Em See Pea tool server and check its live MCP endpoint.
---

This guide deploys one public tool that returns a greeting. You can share its
tool declaration with a Node/Fastify server. The Worker serves MCP
`2026-07-28` over Streamable HTTP at `/mcp`. Use explicit tool declarations
with the Fetch entry point.

For this guide, use Node.js 22.12.0 or newer, npm, curl, and a Cloudflare account
with permission to deploy a Worker. The commands were checked with Node.js
24.22.1 and Wrangler 4.162.0. Use a Workers hostname you control. For this example,
use only the sample data.

## Create the project

Run these commands from a directory where you keep projects. Choose another
name if `hello-mcp-worker` already exists.

```sh title="Create the Worker project" wrap
mkdir hello-mcp-worker
cd hello-mcp-worker
npm init --yes
npm install --save-exact @emseepea/server@0.27.0 @modelcontextprotocol/client@2.3.1 zod@4.6.6
npm install --save-dev --save-exact wrangler@4.162.0
```

Save the following as `tool.mjs`. Import this same file from Node if you also
serve the tool with `createEmseepea`.

```js title="Define the greeting tool" wrap
import { defineTool } from "@emseepea/server";
import { z } from "zod";

export const greet = defineTool({
  name: "greet",
  description: "Return a greeting for the supplied name.",
  access: "public",
  inputSchema: z.object({ name: z.string().min(1) }),
  outputSchema: z.object({ greeting: z.string() }),
  handler: ({ name }) => ({ data: { greeting: `Hello, ${name}!` } }),
});
```

Save this as `worker.mjs`. The example uses a small request limit because the
tool accepts a short name. Set the byte limit to fit your own tool inputs.

```js title="Create the Fetch handler" wrap
import { env } from "cloudflare:workers";
import { createEmseepeaFetch } from "@emseepea/server";
import { greet } from "./tool.mjs";

export default {
  fetch: createEmseepeaFetch({
    name: "hello-mcp",
    version: "1.0.0",
    tools: [greet],
    allowedAuthorities: [env.MCP_AUTHORITY],
    maxRequestBytes: 4096,
  }),
};
```

In the Cloudflare dashboard, open **Workers & Pages** for your account and
find **Your subdomain**. Use the part before `.workers.dev`.
[Cloudflare documents how to find and configure this subdomain](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

Save this as `wrangler.jsonc`. Replace `your-subdomain` with your account
subdomain. The deployed name comes from `name` in this file. The local folder
name can differ. Choose an unused Worker name in your account for this
example. If you change `name`, also change the first part of `MCP_AUTHORITY`. The authority is the hostname with an
optional port. Leave out the scheme and path.

```json title="Configure Wrangler and the allowed hostname" wrap
{
  "name": "hello-mcp",
  "main": "worker.mjs",
  "compatibility_date": "2026-11-16",
  "workers_dev": true,
  "preview_urls": false,
  "vars": {
    "MCP_AUTHORITY": "hello-mcp.your-subdomain.workers.dev"
  }
}
```

This compatibility date enables Node.js APIs for the package dependencies.
See [Cloudflare's Node.js compatibility documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).

## Test the local Worker

Run Wrangler in one terminal. The command supplies the loopback hostname
for this local run.

```sh title="Start a local workerd server" wrap
npx wrangler dev --local --ip 127.0.0.1 --port 8787 --var MCP_AUTHORITY:127.0.0.1:8787
```

Save the following as `check.mjs`. It checks discovery, the tool list, and
one structured result with the MCP client.

```js title="Verify the MCP endpoint" wrap
import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = new URL(process.argv[2]);
const client = new Client({ name: "hello-worker-check", version: "1" }, {
  versionNegotiation: { mode: { pin: "2026-07-28" } },
});

const headers = new Headers();
const token = process.env.MCP_ACCESS_TOKEN;
if (token) headers.set("authorization", `Bearer ${token}`);

try {
  await client.connect(new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers },
  }));
  assert.ok(client.getServerCapabilities()?.tools);
  const { tools } = await client.listTools();
  assert.ok(tools.some(({ name }) => name === "greet"));
  const result = await client.callTool({ name: "greet", arguments: { name: "Pea" } });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, { greeting: "Hello, Pea!" });
  console.log(result.structuredContent.greeting);
} finally {
  await client.close();
}
```

In a second terminal in the project, run:

```sh title="Check the local MCP endpoint" wrap
node check.mjs http://127.0.0.1:8787/mcp
```

The check prints `Hello, Pea!`. Stop Wrangler with Control-C when you finish
local testing.

## Configure request protection

- Set `allowedAuthorities` to the hostname and any port the client uses.
  Forwarding headers cannot change the authority or caller identity.
- If a client sends an Origin header, add its exact HTTPS origin to
  `allowedOrigins`. The example MCP client sends no Origin header. Origin
  checking controls request admission. Configure browser cross-origin access
  separately if your deployment needs it.
- Set `maxRequestBytes` to bound the body during reading. Requests over the
  limit receive HTTP 413 before a tool runs.

## Deploy and check the live endpoint

Check that `MCP_AUTHORITY` matches the hostname you intend to expose. Sign in
to the Cloudflare account that owns it, then deploy.

```sh title="Deploy the Worker" wrap
npx wrangler login
npx wrangler deploy
```

Replace the sample `WORKER_URL` below with the HTTPS address Wrangler
printed. The commands use `MCP_URL` for each check.

```sh title="Call the live MCP endpoint" wrap
WORKER_URL='https://hello-mcp.your-subdomain.workers.dev'
MCP_URL="${WORKER_URL%/}/mcp"
node check.mjs "$MCP_URL"
```

Expect `Hello, Pea!`. Confirm the same Worker rejects a request with an
unlisted Origin, and then a request over the configured byte limit.

```sh title="Check Origin rejection and the body limit" wrap
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  --header 'Origin: https://unlisted.example' --request POST "$MCP_URL"
node -e 'process.stdout.write("x".repeat(4097))' | \
  curl --silent --output /dev/null --write-out '%{http_code}\n' \
    --header 'Content-Type: application/json' --data-binary @- "$MCP_URL"
```

Expect HTTP 403 and HTTP 413.

## Protect a tool with OAuth

This section is optional. Follow it after the public example works if you
want to require credentials for the greeting tool.

Change the greeting tool's declaration to use `access: "protected"` and
`requiredScopes: ["greet:read"]`. Grant that scope in your OAuth provider.
Implement `verifyProviderToken` using your provider's verification or
introspection library and import it in `worker.mjs`. Then add the
`authentication` option after `tools` in the call to `createEmseepeaFetch`.

```js title="Configure protected discovery and OAuth metadata" wrap
authentication: {
  discovery: "protected",
  verifier: { verifyAccessToken: verifyProviderToken },
  metadata: {
    resourceServerUrl: new URL(`https://${env.MCP_AUTHORITY}/mcp`),
    scopesSupported: ["greet:read"],
    oauthMetadata: {
      issuer: "https://login.example.com",
      authorization_endpoint: "https://login.example.com/authorize",
      token_endpoint: "https://login.example.com/token",
      response_types_supported: ["code"],
    },
  },
},
```

Replace the example issuer and endpoint URLs with your provider's URLs.
The verifier checks the token's expiry, issuer, and intended resource before
returning the original `token`, the verified `clientId` and `scopes`,
`expiresAt` in seconds since the Unix epoch, and `resource` as a URL.

Use the exact HTTPS MCP endpoint as the resource URL. Keep provider private
keys and introspection credentials in
[Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
The `discovery: "protected"` setting requires credentials to discover the
server and list its tools.

Run `npx wrangler deploy` again. Obtain a token from your provider for this
MCP endpoint with the `greet:read` scope. In the terminal where you set
`MCP_URL`, run the commands below in Bash or Zsh. Paste the token and press
Enter when `read` waits for input. The token stays hidden as you type.

```sh title="Verify a scoped tool call and clear the token" wrap
read -r -s MCP_ACCESS_TOKEN
export MCP_ACCESS_TOKEN
node check.mjs "$MCP_URL"
unset MCP_ACCESS_TOKEN
```

The check should print `Hello, Pea!`. Run `node check.mjs "$MCP_URL"` again
after clearing the token. The client should report HTTP 401 during discovery.

## Remove the sample Worker

If you no longer need the sample Worker, remove its deployment from the
Cloudflare dashboard. Keep the project and lockfile if you want to redeploy it.
