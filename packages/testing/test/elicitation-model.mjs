#!/usr/bin/env node
// Protocol actor for adapter unit tests only; never semantic qualification evidence.
import { createInterface } from "node:readline";
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
emit({ type: "system", subtype: "init", tools: ["mcp__emseepea_eval__create"],
  mcp_servers: [{ name: "emseepea_eval", status: "connected" }] });
let prompt;
const ask = () => emit({ type: "control_request", request_id: "request-1", request: {
  subtype: "elicitation", mcp_server_name: "emseepea_eval", mode: "form",
  message: "Create Synthetic Customer?", requested_schema: { type: "object" },
  headers: { Authorization: "provider-envelope-sentinel" },
} });
createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.type === "user") {
    prompt = message.message.content[0].text;
    emit({ type: "assistant", message: { content: [{ type: "tool_use", id: "call-1",
      name: "mcp__emseepea_eval__create", input: { name: "Synthetic Customer" } }] } });
    ask();
    return;
  }
  if (message.type !== "control_response" || message.response.request_id !== "request-1"
    || message.response.subtype !== "success") process.exit(1);
  if (prompt === "duplicate") { ask(); return; }
  emit({ type: "user", message: { role: "user", content: [{ type: "tool_result",
    tool_use_id: "call-1", content: JSON.stringify(message.response.response) }] } });
  emit({ type: "result", is_error: false, num_turns: 2, permission_denials: [],
    result: message.response.response.action, modelUsage: {
      "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" },
    } });
});
