import { fixtureForState, viewFromSubmission } from "@emseepea/example-ui-shared";
import { renderElicitationForm } from "@emseepea/server";

export function pageFromQuery(value: unknown): string {
  const query = record(value);
  return page(
    fixtureForState(query.state),
    first(query.theme) === "dark" ? "dark" : "light",
    first(query.style) !== "off",
  );
}

export function pageFromSubmission(value: unknown): string {
  return page(viewFromSubmission(value), "light", true);
}

function page(view: unknown, theme: "light" | "dark", styled: boolean): string {
  return `<!doctype html><html lang="en" data-emseepea-theme="${theme}"><head>` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>Pea planting plan preview - Em See Pea</title>${styled ? '<link rel="stylesheet" href="/emseepea.css">' : ""}` +
    `</head><body><a href="#main-content">Skip to main content</a><main id="main-content" tabindex="-1">` +
    `<h1>Native form example</h1>${renderElicitationForm(view, { headingLevel: 2 })}</main></body></html>`;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function first(value: unknown): string | undefined {
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}
