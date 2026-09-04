import { readFile } from "node:fs/promises";
import { parse } from "node:querystring";

import {
  fixtureForState,
  viewFromSubmission,
} from "@emseepea/example-ui-shared";
import { ElicitationForm } from "@emseepea/react";
import { createEmseepea, discoverCapabilities, serveEmseepea, type ElicitationView } from "@emseepea/server";
import { renderToString } from "react-dom/server";

const stylesheet = await readFile(new URL(import.meta.resolve("@emseepea/tailwind/styles.css")), "utf8");
const client = await readFile(new URL("./client.js", import.meta.url), "utf8");
const app = createEmseepea({
  name: "emseepea-react-tailwind-ui",
  version: "0.0.0",
  instructions: "Use preview-bean-report to preview sample report content. It sends and stores nothing.",
  ...await discoverCapabilities(new URL("./capabilities/", import.meta.url)),
});

app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_request, body, done) => done(null, parse(body.toString())),
);
app.get("/emseepea.css", async (_request, reply) => {
  await reply.type("text/css; charset=utf-8").header("cache-control", "no-store").send(stylesheet);
});
app.get("/client.js", async (_request, reply) => {
  await reply.type("text/javascript; charset=utf-8").header("cache-control", "no-store").send(client);
});
app.get("/", async (request, reply) => {
  const query = record(request.query);
  const view = fixtureForState(query.state);
  await reply.type("text/html; charset=utf-8").send(page(
    view,
    first(query.theme) === "dark" ? "dark" : "light",
    first(query.style) !== "off",
  ));
});
app.post("/", async (request, reply) => {
  await reply.type("application/json; charset=utf-8").send(viewFromSubmission(request.body));
});

const running = await serveEmseepea(app, { port: Number.parseInt(process.env.PORT ?? "3001", 10) });
console.log(`Em See Pea React UI example listening at ${running.url}`);

async function shutdown(): Promise<void> {
  await running.close();
  process.exitCode = 0;
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

function page(view: ElicitationView, theme: "light" | "dark", styled: boolean): string {
  const markup = renderToString(<ElicitationForm view={view} headingLevel={2} />);
  return `<!doctype html><html lang="en" data-emseepea-theme="${theme}"><head>` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>Bean report preview - Em See Pea</title>${styled ? '<link rel="stylesheet" href="/emseepea.css">' : ""}` +
    `</head><body><a href="#main-content">Skip to main content</a><main id="main-content" tabindex="-1">` +
    `<h1>React and Tailwind form example</h1><div id="app">${markup}</div></main>` +
    `<script id="emseepea-view" type="application/json">${safeJson(view)}</script>` +
    `<script type="module" src="/client.js"></script></body></html>`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("&", "\\u0026").replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
function first(value: unknown): string | undefined {
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}
