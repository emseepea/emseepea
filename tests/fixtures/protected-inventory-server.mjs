import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const resourceServerUrl = new URL("https://inventory.example/mcp");

const app = createEmseepea({
  name: "protected-inventory-fixture",
  version: "0.0.0",
  tools: [defineTool({
    name: "get-private-inventory-report",
    access: "protected",
    requiredScopes: ["inventory:read"],
    description: "Return packet inventory available to promise.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      onHand: z.number(),
      reserved: z.number(),
      inbound: z.number(),
    }),
    handler: () => ({ data: { onHand: 120, reserved: 35, inbound: 40 } }),
  })],
  authentication: {
    verifier: {
      async verifyAccessToken(token) {
        if (token !== "example-access-token") {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid test token");
        }
        return {
          token,
          clientId: "test-client",
          scopes: ["inventory:read"],
          expiresAt: Math.floor(Date.now() / 1_000) + 3_600,
          resource: resourceServerUrl,
        };
      },
    },
    metadata: {
      resourceServerUrl,
      scopesSupported: ["inventory:read"],
      oauthMetadata: {
        issuer: "https://auth.example",
        authorization_endpoint: "https://auth.example/authorize",
        token_endpoint: "https://auth.example/token",
        response_types_supported: ["code"],
      },
    },
  },
});

const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Protected inventory fixture listening at ${running.url}`);

async function shutdown() {
  await running.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
