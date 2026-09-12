import { plantingPlanAppResourceUri } from "@emseepea/example-ui-shared";
import { defineResource, type AccessPolicy, type CapabilityModuleFactory } from "@emseepea/server";

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

const appHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pea planting plan result</title></head>
<body><main><h1>Pea planting plan result</h1><p id="status" role="status" aria-live="polite" aria-atomic="true">Waiting for the preview result.</p><ul id="varieties"></ul></main>
<script>
const status = document.querySelector("#status");
const list = document.querySelector("#varieties");
const initializeId = 1;
const connectionTimeout = setTimeout(() => {
  status.textContent = "The preview could not connect to its host.";
}, 10000);
window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.id === initializeId) {
    clearTimeout(connectionTimeout);
    if (event.data.error) {
      status.textContent = "The preview could not connect to its host.";
      return;
    }
    window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized" }, "*");
    return;
  }
  if (event.data?.method === "ui/notifications/tool-cancelled") {
    status.textContent = "The preview was cancelled.";
    return;
  }
  if (event.data?.method !== "ui/notifications/tool-result") return;
  const result = event.data.params?.structuredContent;
  if (!Number.isInteger(result?.matchingCount) || !Array.isArray(result?.varieties)) {
    status.textContent = "The preview result could not be displayed.";
    return;
  }
  status.textContent = result.matchingCount + (result.matchingCount === 1 ? " sample variety matches." : " sample varieties match.");
  list.replaceChildren(...result.varieties.flatMap((variety) =>
    typeof variety?.name === "string" ? [Object.assign(document.createElement("li"), { textContent: variety.name })] : []));
}, { passive: true });
window.parent.postMessage({
  jsonrpc: "2.0",
  id: initializeId,
  method: "ui/initialize",
  params: {
    protocolVersion: "2026-01-26",
    appInfo: { name: "Pea planting plan result", version: "1.0.0" },
    appCapabilities: { availableDisplayModes: ["inline"] },
  },
}, "*");
</script></body></html>`;
