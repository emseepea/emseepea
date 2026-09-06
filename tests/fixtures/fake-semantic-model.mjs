#!/usr/bin/env node

const prompt = process.argv[process.argv.indexOf("--print") + 1] ?? "";
const currentMessage = prompt.split("Current user message:\n").at(-1) ?? "";
const plans = [
  ["Call the shared harvest report twice", [
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
    { name: "create-shared-harvest-report", arguments: { requestId: "daily-harvest-report" } },
  ]],
  ["Which server instance is handling", [{ name: "describe-instance", arguments: {} }]],
  ["Compare that with Harbour Gem", [{ name: "get-pea-variety", arguments: { name: "Harbour Gem" } }]],
  ["Describe the pea type", [{ name: "get-pea-variety", arguments: { name: "Highland Snap" } }]],
  ["Search the public taxon catalogue", [{ name: "search-pea-taxa", arguments: { query: "pea" } }]],
  ["How many pea seed packets", [{ name: "get-private-inventory-report", arguments: {} }]],
  ["Preview a plan titled Snap pea plan", [{
    name: "preview-planting-plan",
    arguments: { title: "Snap pea plan", peaType: "snap", includeTips: true },
  }]],
  ["Preview a plan titled All pea plan", [{
    name: "preview-planting-plan",
    arguments: { title: "All pea plan", peaType: "all", includeTips: false },
  }]],
  ["Run the sample-tray", [{ name: "run-germination-trial", arguments: { tray: "sample-tray" } }]],
];
const selected = plans.find(([message]) => currentMessage.includes(message));
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
