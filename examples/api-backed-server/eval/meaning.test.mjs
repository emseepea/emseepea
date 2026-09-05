import { toolSelectionTest } from "@emseepea/testing/semantic";

toolSelectionTest("Taxon fields retain their documented meaning", {
  server: new URL("../test-support/llm-server.mjs", import.meta.url),
  question:
    "Search the public taxon catalogue for pea species. Give the scientific and " +
    "common names of each result, say which has more recorded observations, and " +
    "explain whether that count estimates the wild population.",
  criticalFacts: [
    "Pisum sativum",
    "Common Pea",
    "Lathyrus odoratus",
    "Sweet Pea",
    /8,?720/,
    /6,?240/
  ],
  criteria:
    "The answer reports Pisum sativum as Common Pea and Lathyrus odoratus as Sweet " +
    "Pea. It says Pisum sativum has more recorded observations, 8720 compared with " +
    "6240. It explains that observations_count is a count of recorded observations, " +
    "not an estimate of the wild population.",
  expectedTools: ["search-pea-taxa"],
});
