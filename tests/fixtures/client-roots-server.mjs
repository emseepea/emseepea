import { createEmseepea, defineTool, inputRequired, rootsResponse, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const app = createEmseepea({
  name: "roots-process-test", version: "0.0.0", clientRoots: {},
  requestState: { key: "0123456789abcdef0123456789abcdef", ttlSeconds: 60 },
  tools: [defineTool({
    name: "roots", access: "public", description: "Resume roots after a process restart.",
    inputSchema: z.object({}), outputSchema: z.object({ uri: z.string(), value: z.string() }),
    async handler(_input, context) {
      const roots = rootsResponse(context.inputResponses, "workspace");
      if (roots !== undefined) return { data: { uri: roots[0].uri, value: context.requestState.value } };
      return inputRequired({ inputRequests: { workspace: inputRequired.roots() },
        requestState: await context.mintRequestState({ value: "survived" }) });
    },
  })],
});
const running = await serveEmseepea(app, { port: 0 });
process.send(running.url.href);
process.on("message", async (message) => {
  if (message !== "close") return;
  await running.close();
  process.exit(0);
});
