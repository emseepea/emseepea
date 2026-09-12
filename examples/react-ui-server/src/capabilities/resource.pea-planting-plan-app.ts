import { plantingPlanAppResourceUri } from "@emseepea/example-ui-shared";
import { defineResource, type AccessPolicy, type CapabilityModuleFactory } from "@emseepea/server";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ResultApp } from "../mcp-app.js";

const csp = { connectDomains: [], resourceDomains: [] };
const legacyCsp = { connect_domains: [], resource_domains: [] };

export default ((access) => defineResource({
  name: "pea-planting-plan-app",
  ...access,
  uri: plantingPlanAppResourceUri,
  title: "Pea planting plan result",
  description: "An accessible result card for the pea planting-plan preview tool.",
  mimeType: "text/html;profile=mcp-app",
  handler: () => ({
    contents: [{
      uri: plantingPlanAppResourceUri,
      mimeType: "text/html;profile=mcp-app",
      text: appHtml,
      _meta: {
        ui: { prefersBorder: true, csp },
        "openai/widgetPrefersBorder": true,
        "openai/widgetCSP": legacyCsp,
      },
    }],
  }),
})) satisfies CapabilityModuleFactory<AccessPolicy>;

const appScript = readFileSync(new URL("../mcp-app-client.js", import.meta.url), "utf8").replaceAll("</script", "<\\/script");
const appHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<title>Pea planting plan result</title><style>` +
  `button{min-block-size:24px} :focus-visible{outline:2px solid currentColor;outline-offset:2px}` +
  `</style></head><body><main id="app">` +
  `${renderToString(createElement(ResultApp))}</main><script type="module">${appScript}</script></body></html>`;
