#!/usr/bin/env node

import { createInterface } from "node:readline";

const modelUsage = {
  "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" },
};
const result = (answer, callCount = 0) => ({
  type: "result",
  is_error: false,
  num_turns: callCount + 1,
  permission_denials: [],
  modelUsage,
  result: answer,
});

if (!process.argv.includes("--input-format")) {
  const prompt = process.argv[process.argv.indexOf("--print") + 1] ?? "";
  const answer = prompt.includes("Return only JSON with this exact shape")
    ? '{"pass":true,"score":1,"reason":"The answer preserves every required meaning."}'
    : prompt;
  process.stdout.write(`${JSON.stringify(result(answer))}\n`);
} else {
  const tools = (process.argv[process.argv.indexOf("--tools") + 1] ?? "").split(",").filter(Boolean);
  process.stdout.write(`${JSON.stringify({
    type: "system",
    subtype: "init",
    tools,
    mcp_servers: [{ name: "emseepea_eval", status: "connected" }],
  })}\n`);
  createInterface({ input: process.stdin }).on("line", (line) => {
    const prompt = JSON.parse(line).message.content[0].text;
    const { calls, answer } = responseFor(prompt);
    calls.forEach((call, index) => {
      const id = `call-${index}`;
      process.stdout.write(`${JSON.stringify({ type: "assistant", message: { content: [{
        type: "tool_use",
        id,
        name: `mcp__emseepea_eval__${call.name}`,
        input: call.arguments,
      }] } })}\n`);
      process.stdout.write(`${JSON.stringify({ type: "user", message: { role: "user", content: [{
        type: "tool_result",
        tool_use_id: id,
        content: "{}",
      }] } })}\n`);
    });
    process.stdout.write(`${JSON.stringify(result(answer, calls.length))}\n`);
  });
}

function responseFor(prompt) {
  if (prompt.includes("Create a shared harvest report with request ID daily-harvest-report")) return {
    calls: [
      { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
      { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
    ],
    answer: "eval-instance created four plants: two shelling and two snap. The request ID reuses the report and creates no other report.",
  };
  if (prompt.includes("What exact createdByInstance value")) return { calls: [], answer: "eval-instance" };
  if (prompt.includes("Which server instance is handling")) return {
    calls: [{ name: "describe-instance", arguments: {} }], answer: "eval-instance",
  };
  if (prompt.includes("Compare that with Harbour Gem")) return {
    calls: [{ name: "get-pea-variety", arguments: { name: "Harbour Gem" } }],
    answer: "Harbour Gem is a bush shelling pea that matures in 62 days.",
  };
  if (prompt.includes("Describe the pea type")) return {
    calls: [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }],
    answer: "Highland Snap is a climbing snap pea that matures in 70 days, has edible pods, and needs support.",
  };
  if (prompt.includes("Search the public taxon catalogue")) return {
    calls: [{ name: "search-pea-taxa", arguments: { query: "pea" } }],
    answer: "Pisum sativum, commonly Common Pea, has 8,720 observations. That is not a wild population estimate.",
  };
  if (prompt === "What was its common name?") return { calls: [], answer: "Common Pea" };
  if (prompt.includes("How many pea seed packets")) return {
    calls: [{ name: "get-private-inventory-report", arguments: {} }],
    answer: "85 packets are available: 120 on hand minus 35 reserved. The 40 inbound packets do not count yet.",
  };
  if (prompt.includes("How many packets were inbound")) return { calls: [], answer: "40" };
  if (prompt.includes("Preview a plan titled Snap pea plan")) return {
    calls: [{ name: "preview-planting-plan", arguments: {
      title: "Snap pea plan", peaType: "snap", includeTips: true,
    } }],
    answer: "Highland Snap and Meadow Sweet are previewed. Nothing was sent, stored, or changed.",
  };
  if (prompt.includes("Preview a plan titled All pea plan")) return {
    calls: [{ name: "preview-planting-plan", arguments: {
      title: "All pea plan", peaType: "all", includeTips: false,
    } }],
    answer: "Harbour Gem, Highland Snap, and Meadow Sweet are previewed without tips. Nothing was sent, stored, or changed.",
  };
  if (prompt.includes("How many snap varieties")) return { calls: [], answer: "2" };
  if (prompt.includes("How many varieties were")) return { calls: [], answer: "3" };
  if (prompt.includes("Run the sample-tray")) return {
    calls: [{ name: "run-germination-trial", arguments: { tray: "sample-tray" } }],
    answer: "sample-tray progressed through soak, sow, and sprout, then completed with 8 of 10 seeds germinated.",
  };
  if (prompt.includes("immediately after soak")) return { calls: [], answer: "sow" };
  return {
    calls: [],
    answer: "I cannot know that recommendation until you select or attach the resource.",
  };
}
