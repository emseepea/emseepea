// Test-only browser bundle. Importing this must not pull in the server runtime.
export { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
export { registerWebMcp } from "../dist/webmcp.js";
