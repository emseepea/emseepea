import assert from "node:assert/strict";
import { semanticTest } from "@emseepea/testing/semantic";

semanticTest("Coffee ratings retain their documented meaning", {
  server: new URL("../test-support/llm-server.mjs", import.meta.url),
  question:
    "Search the coffee catalogue for natural coffees. Name each returned coffee, " +
    "its roaster and origin, say whether more matches are available, and explain " +
    "exactly what the acidity and body scores mean. Which coffee is more acidic, " +
    "and which has the fuller body?",
  criticalFacts: [
    "Riverlight Natural",
    "North Star Sample Roasters",
    "Burundi",
    "Cedar Grove",
    "Harbour Sample Coffee",
    "Colombia",
    "more matches",
    "low acidity",
    "high acidity",
    "light body",
    "full body"
  ],
  criteria:
    "The answer reports Riverlight Natural by North Star Sample Roasters from " +
    "Burundi and Cedar Grove by Harbour Sample Coffee from Colombia. It says more " +
    "matches are available. It explains that acidity runs from 1 for low acidity to " +
    "5 for high acidity, while body runs from 1 for light body to 5 for full body. " +
    "It identifies Riverlight Natural as more acidic and Cedar Grove as having the " +
    "fuller body. It does not treat either score as a quality rating or reverse " +
    "either scale.",
  requiredPaths: ["tools/call:search-coffee-catalog"],
  async exercise(client) {
    const result1 = await client.callTool({"name":"search-coffee-catalog","arguments":{"query":"natural"}});
    assert.ok(result1);
  },
});
