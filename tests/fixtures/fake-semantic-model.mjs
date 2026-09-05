#!/usr/bin/env node

const prompt = process.argv[process.argv.indexOf("--print") + 1] ?? "";
const plans = [
  ["create-shared-harvest-report", [
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
  ]],
  ["get-pea-variety", [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }]],
  ["search-pea-taxa", [{ name: "search-pea-taxa", arguments: { query: "pea" } }]],
  ["get-private-inventory-report", [{ name: "get-private-inventory-report", arguments: {} }]],
  ["preview-planting-plan", [{
    name: "preview-planting-plan",
    arguments: { title: "Snap pea plan", peaType: "snap", includeTips: true },
  }]],
  ["run-germination-trial", [{ name: "run-germination-trial", arguments: { tray: "sample-tray" } }]],
];
const selected = plans.find(([name]) => prompt.includes(name));
const answer = prompt.includes("JSON tool plan")
  ? JSON.stringify({ calls: selected?.[1] ?? [] })
  : prompt.includes("Return only JSON with this exact shape")
    ? '{"pass":true,"score":1,"reason":"The answer preserves every required meaning."}'
    : prompt.includes("reusesOriginalReport (boolean)")
      ? JSON.stringify({
        createdByInstance: "eval-instance",
        totalPlants: 4,
        peaTypeCounts: { shelling: 2, snap: 2 },
        reusesOriginalReport: true,
        createsAnotherReport: false,
      })
      : prompt;
const result = {
  type: "result",
  is_error: false,
  num_turns: 1,
  permission_denials: [],
  modelUsage: { "claude-sonnet-4-6": { canonicalModel: "claude-sonnet-4-6", provider: "firstParty" } },
};
if (process.argv.includes("--json-schema")) result.structured_output = JSON.parse(answer);
else result.result = answer;
process.stdout.write(`${JSON.stringify(result)}\n`);
