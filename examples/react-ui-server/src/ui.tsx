import { fixtureForState, viewFromSubmission } from "@emseepea/example-ui-shared";
import { ElicitationForm } from "@emseepea/react";
import type { ElicitationView } from "@emseepea/server";
import { renderToString } from "react-dom/server";

export function pageFromQuery(value: unknown): string {
  const query = record(value);
  return page(
    fixtureForState(query.state),
    first(query.theme) === "dark" ? "dark" : "light",
    first(query.style) !== "off",
  );
}

export function submittedView(value: unknown): ElicitationView {
  return viewFromSubmission(value);
}

function page(view: ElicitationView, theme: "light" | "dark", styled: boolean): string {
  const markup = renderToString(<ElicitationForm view={view} headingLevel={2} />);
  return `<!doctype html><html lang="en" data-emseepea-theme="${theme}"><head>` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>Pea planting plan preview - Em See Pea</title>${styled ? '<link rel="stylesheet" href="/emseepea.css">' : ""}` +
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
