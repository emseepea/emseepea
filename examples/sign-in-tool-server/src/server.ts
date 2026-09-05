import { createEmseepea, discoverCapabilities, serveEmseepea } from "@emseepea/server";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";

const resourceServerUrl = new URL("https://inventory.example/mcp");
const demoToken = "example-access-token";

const app = createEmseepea({
  name: "emseepea-sign-in-tool-server",
  version: "0.0.0",
  instructions: "Use get-private-inventory-report for private inventory availability.",
  ...await discoverCapabilities(new URL("./capabilities/", import.meta.url)),
  oauth: {
    verifier: {
      async verifyAccessToken(token) {
        if (token !== demoToken && token !== "example-wrong-scope") {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid sample token");
        }
        return {
          token,
          clientId: "synthetic-inventory-client",
          scopes: token === demoToken ? ["inventory:read"] : ["profile:read"],
          expiresAt: Math.floor(Date.now() / 1_000) + 3_600,
          resource: resourceServerUrl,
        };
      },
    },
    metadata: {
      resourceServerUrl,
      resourceName: "Sample private inventory",
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

console.log(`Em See Pea protected no-UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
