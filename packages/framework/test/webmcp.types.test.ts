import { Client } from "@modelcontextprotocol/client";
import { registerWebMcp, type McpWebClient, type WebMcpModelContext } from "../dist/webmcp.js";

declare const client: Client;
declare const modelContext: WebMcpModelContext;
const compatible: McpWebClient = client;
void registerWebMcp({ client: compatible, modelContext, filter: (tool) => tool.name !== "excluded" });
// @ts-expect-error The adapter accepts a connected client, not a server URL.
void registerWebMcp({ client: "https://example.test/mcp" });
