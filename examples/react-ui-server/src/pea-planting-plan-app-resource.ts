import { plantingPlanAppResourceUri } from "@emseepea/example-ui-shared";
import { defineMcpAppResource, type AccessPolicy, type McpAppResource } from "@emseepea/server";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ResultApp } from "./mcp-app.js";

const definitions = new WeakMap<AccessPolicy, McpAppResource>();

export function plantingPlanAppResource(access: AccessPolicy): McpAppResource {
  let definition = definitions.get(access);
  if (!definition) {
    definition = defineMcpAppResource({
      name: "pea-planting-plan-app",
      ...access,
      uri: plantingPlanAppResourceUri,
      title: "Pea planting plan result",
      description: "An accessible result card for the pea planting-plan preview tool.",
      language: "en",
      bodyMarkup: `<main id="app">${renderToString(createElement(ResultApp))}</main>`,
      styles: "button{min-block-size:24px} :focus-visible{outline:2px solid currentColor;outline-offset:2px}",
      bundleUrl: new URL("./mcp-app-client.js", import.meta.url),
      csp: { connectDomains: [], resourceDomains: [] },
      prefersBorder: true,
    });
    definitions.set(access, definition);
  }
  return definition;
}
