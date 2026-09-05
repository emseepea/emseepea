import { parse } from "node:querystring";

import { createEmseepea, discoverCapabilities, registerRoutes, serveEmseepea } from "@emseepea/server";

const app = createEmseepea({
  name: "emseepea-react-ui-server",
  version: "0.0.0",
  instructions: "Use preview-planting-plan to preview a sample pea planting plan. It sends and stores nothing.",
  ...await discoverCapabilities(new URL("./capabilities/", import.meta.url)),
});

app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_request, body, done) => done(null, parse(body.toString())),
);
await registerRoutes(app, new URL("./routes/", import.meta.url));

const running = await serveEmseepea(app, { port: Number.parseInt(process.env.PORT ?? "3001", 10) });
console.log(`Em See Pea React UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
