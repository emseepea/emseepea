import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
import { defineFeedbackSubmission } from "../dist/index.js";
import { z } from "zod";

const feedback = defineFeedbackSubmission({
  access: "public",
  scope: "semantic-test",
  backend: {
    submit: () => ({
      id: "feedback-1",
      recordedAt: "2026-09-10T00:00:00.000Z",
    }),
  },
});
const search = defineTool({
  name: "search-pea-varieties",
  access: "public",
  title: "Search Pea Varieties",
  description: "Search the application pea-variety catalogue.",
  inputSchema: z.strictObject({ query: z.string().min(1).describe("Variety search terms.") }),
  outputSchema: z.strictObject({
    matches: z.array(z.string()).describe("Matching varieties."),
    attempts: z.number().int().positive().describe("Number of interface attempts needed for this search."),
    interfaceNote: z.string().describe("Observed application interface behavior."),
  }),
  handler: ({ query }) => query.toLowerCase().includes("example missing variety")
    ? { data: { matches: [], attempts: 1, interfaceNote: "The search completed normally." } }
    : query.toLowerCase().includes("shelling")
      ? { data: { matches: ["Harbour Gem"], attempts: 1, interfaceNote: "The search completed normally." } }
      : {
          data: {
            matches: ["Highland Snap"],
            attempts: 3,
            interfaceNote: "The variety filter was below the results and difficult to find.",
          },
        },
});
const app = createEmseepea({
  name: "feedback-submission-eval",
  version: "0.0.0",
  tools: [search, feedback],
});
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});
console.log(`Feedback submission eval server listening at ${running.url}`);

process.once("SIGINT", () => void running.close());
process.once("SIGTERM", () => void running.close());
