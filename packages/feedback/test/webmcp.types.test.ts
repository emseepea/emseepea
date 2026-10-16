import type { Client } from "@modelcontextprotocol/client";
import { registerFeedbackWebMcp, type FeedbackMcpClient } from "../dist/webmcp.js";

declare const client: Client;
const structural: FeedbackMcpClient = client;
void registerFeedbackWebMcp({ client: structural });
void registerFeedbackWebMcp({ client, toolName: "submit-customer-feedback", signal: new AbortController().signal });
// @ts-expect-error clients must support checked tool execution
void registerFeedbackWebMcp({ client: { listTools: client.listTools } });
