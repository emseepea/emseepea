#!/usr/bin/env node

const prompt = process.argv[process.argv.indexOf("--print") + 1] ?? "";
const plans = [
  ["create-shared-bean-report", [
    { name: "create-shared-bean-report", arguments: { requestId: "daily-roast-report" } },
    { name: "create-shared-bean-report", arguments: { requestId: "daily-roast-report" } },
  ]],
  ["get-bean-details", [{ name: "get-bean-details", arguments: { name: "Highland Bloom" } }]],
  ["search-coffee-catalog", [{ name: "search-coffee-catalog", arguments: { query: "natural process coffee" } }]],
  ["get-private-inventory-report", [{ name: "get-private-inventory-report", arguments: {} }]],
  ["preview-bean-report", [{
    name: "preview-bean-report",
    arguments: { title: "Dark roast preview", roast: "dark", includeNotes: true },
  }]],
  ["roast-sample-batch", [{ name: "roast-sample-batch", arguments: { batch: "sample-batch" } }]],
];
const selected = plans.find(([name]) => prompt.includes(name));
const answer = prompt.includes("JSON tool plan")
  ? JSON.stringify({ calls: selected?.[1] ?? [] })
  : prompt.includes("Return only JSON with this exact shape")
    ? '{"pass":true,"score":1,"reason":"The answer preserves every required meaning."}'
    : prompt.includes("reusesOriginalReport (boolean)")
      ? JSON.stringify({
        createdByInstance: "eval-instance",
        totalBeans: 4,
        roastCounts: { light: 1, medium: 2, dark: 1 },
        reusesOriginalReport: true,
        createsAnotherReport: false,
      })
      : prompt;
process.stdout.write(`${JSON.stringify({
  type: "result",
  is_error: false,
  num_turns: 1,
  permission_denials: [],
  result: answer,
  modelUsage: { "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" } },
})}\n`);
