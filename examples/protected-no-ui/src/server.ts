import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { z } from "zod";

const resourceServerUrl = new URL("https://inventory.example/mcp");
const demoToken = "example-access-token";

const inventoryReport = {
  item: "Green coffee bags",
  onHandBags: 120,
  reservedBags: 35,
  availableToPromiseBags: 85,
  inboundBags: 40,
  inboundAvailableToPromise: false,
} as const;

const getPrivateInventoryReport = defineTool({
  name: "get-private-inventory-report",
  access: "protected",
  requiredScopes: ["inventory:read"],
  title: "Private Inventory Report",
  description: "Report private on-hand, reserved, available-to-promise, and inbound inventory.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    item: z.string(),
    onHandBags: z.number().int().nonnegative(),
    reservedBags: z.number().int().nonnegative(),
    availableToPromiseBags: z.number().int().nonnegative(),
    inboundBags: z.number().int().nonnegative(),
    inboundAvailableToPromise: z.boolean(),
  }),
  handler: () => ({
    text: [
      "Green coffee bags inventory:",
      "- 120 on hand",
      "- 35 reserved",
      "- 85 available to promise (120 on hand minus 35 reserved)",
      "- 40 inbound, not yet available to promise",
    ].join("\n"),
    data: inventoryReport,
  }),
});

const app = createEmseepea({
  name: "emseepea-protected-no-ui",
  version: "0.0.0",
  instructions: "Use get-private-inventory-report for private inventory availability.",
  tools: [getPrivateInventoryReport],
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
