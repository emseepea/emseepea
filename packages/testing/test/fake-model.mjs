#!/usr/bin/env node

const prompt = process.argv[process.argv.indexOf("--print") + 1] ?? "";
const answer = prompt.includes("Return only JSON with this exact shape")
  ? '{"pass":true,"score":1,"reason":"The answer preserves every required meaning."}'
  : "Highland Bloom is a medium-roast, naturally processed Bourbon from Sample Highlands with berry and cocoa tasting notes.";

process.stdout.write(`${JSON.stringify({
  type: "result",
  is_error: false,
  num_turns: 1,
  permission_denials: [],
  result: answer,
  modelUsage: {
    "claude-sonnet-4-6": {
      canonicalModel: "claude-sonnet-4-6",
      provider: "firstParty",
    },
  },
})}\n`);
