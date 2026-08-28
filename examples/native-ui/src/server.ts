import { readFile } from "node:fs/promises";
import { parse } from "node:querystring";

import {
  createPreviewBeanReportTool,
  fixtureForState,
  viewFromSubmission,
} from "@emseepea/example-ui-shared";
import { createEmseepea, renderElicitationForm, serveEmseepea } from "@emseepea/server";

const stylesheet = await readFile(new URL(import.meta.resolve("@emseepea/tailwind/styles.css")), "utf8");
const app = createEmseepea({
  name: "emseepea-native-ui",
  version: "0.0.0",
  instructions: "Use preview-bean-report to preview sample report content. It sends and stores nothing.",
  tools: [createPreviewBeanReportTool()],
});

app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_request, body, done) => done(null, parse(body.toString())),
);
app.get("/emseepea.css", async (_request, reply) => {
  await reply.type("text/css; charset=utf-8").header("cache-control", "no-store").send(stylesheet);
});
app.get("/", async (request, reply) => {
  const query = record(request.query);
  await reply.type("text/html; charset=utf-8").send(page(
    fixtureForState(query.state),
    first(query.theme) === "dark" ? "dark" : "light",
    first(query.style) !== "off",
  ));
});
app.post("/", async (request, reply) => {
  await reply.type("text/html; charset=utf-8").send(page(viewFromSubmission(request.body), "light", true));
});

const running = await serveEmseepea(app, { port: Number.parseInt(process.env.PORT ?? "3000", 10) });
console.log(`Em See Pea native UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

function page(view: unknown, theme: "light" | "dark", styled: boolean): string {
  return `<!doctype html><html lang="en" data-emseepea-theme="${theme}"><head>` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>Bean report preview - Em See Pea</title>${styled ? '<link rel="stylesheet" href="/emseepea.css">' : ""}` +
    `</head><body><a href="#main-content">Skip to main content</a><main id="main-content" tabindex="-1">` +
    `<h1>Native form example</h1>${renderElicitationForm(view, { headingLevel: 2 })}</main></body></html>`;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
function first(value: unknown): string | undefined {
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}
