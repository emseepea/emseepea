import {
  createEmseepea,
  defineTool,
  inputRequired,
  serveEmseepea,
} from "@emseepea/server";
import { z } from "zod";

const stateSchema = z.object({ value: z.string() });
const tool = defineTool({
  name: "alpha",
  access: "public",
  description: "Resume signed state in another process.",
  inputSchema: z.object({}),
  outputSchema: stateSchema,
  async handler(_input, context) {
    const state = stateSchema.safeParse(context.requestState);
    if (state.success) return { data: state.data };
    return inputRequired({ requestState: await context.mintRequestState({ value: "alpha" }) });
  },
});
const app = createEmseepea({
  name: "request-state-child",
  version: "0.0.0",
  tools: [tool],
  requestState: {
    key: "0123456789abcdef0123456789abcdef",
    ttlSeconds: 60,
    maxBytes: 4 * 1024,
  },
});
const running = await serveEmseepea(app, { port: 0 });
process.send?.(running.url.href);
process.on("message", async (message) => {
  if (message !== "close") return;
  await running.close();
  process.exit(0);
});
