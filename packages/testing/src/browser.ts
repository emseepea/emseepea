import type { McpAppHostContext } from "@emseepea/server/ui";

import {
  createMcpAppHostProtocol,
  type McpAppMessageRequest,
} from "./mcp-app-host.js";

export interface McpAppDevelopmentHostOptions {
  readonly container: HTMLElement;
  readonly entryPoint: string | URL;
  readonly fixtures: Readonly<Record<string, unknown>>;
  readonly rootElementId: string;
  readonly hostContext?: McpAppHostContext;
  readonly messageResponse?: "succeed" | "reject";
  readonly reducedMotion?: boolean;
  readonly searchParams?: URLSearchParams;
  readonly title?: string;
  readonly width?: number;
}

export interface McpAppDevelopmentHost {
  readonly iframe: HTMLIFrameElement;
  initialized(): boolean;
  messageRequests(): readonly McpAppMessageRequest[];
  deliverFixture(name: string): void;
  changeHostContext(context: Partial<McpAppHostContext>): void;
  setContainerWidth(width?: number): void;
  destroy(): void;
}

/** Run a compiled MCP App in a small, framework-neutral browser host. */
export function createMcpAppDevelopmentHost(
  options: McpAppDevelopmentHostOptions,
): McpAppDevelopmentHost {
  if (!options.container || typeof options.container.append !== "function") {
    throw new TypeError("container must be an HTML element");
  }
  if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(options.rootElementId)) {
    throw new TypeError("rootElementId must be a valid non-empty HTML ID");
  }
  const fixtureNames = Object.keys(options.fixtures);
  if (fixtureNames.length === 0) throw new TypeError("fixtures must contain at least one fixture");

  const params = options.searchParams ?? new URLSearchParams(location.search);
  const fixtureName = params.get("fixture") ?? fixtureNames[0]!;
  fixture(options.fixtures, fixtureName);
  const requestedTheme = params.get("theme");
  const theme = requestedTheme === "light" || requestedTheme === "dark"
    ? requestedTheme
    : options.hostContext?.theme;
  const messageResponse = params.get("message") === "reject" ? "reject" : options.messageResponse ?? "succeed";
  const reducedMotion = params.get("motion") === "reduce" || options.reducedMotion === true;
  const width = params.has("width") ? checkedWidth(params.get("width")) : checkedWidth(options.width);

  const iframe = document.createElement("iframe");
  iframe.title = options.title ?? "MCP App preview";
  options.container.append(iframe);
  setWidth(iframe, width);

  const child = iframe.contentWindow;
  const childDocument = iframe.contentDocument;
  if (!child || !childDocument) throw new Error("The development host could not create its preview frame.");

  const protocol = createMcpAppHostProtocol({
    hostContext: { ...options.hostContext, ...(theme ? { theme } : {}) },
  }, (message) => child.postMessage(message, "*"));

  const receive = (event: MessageEvent<unknown>) => {
    if (event.source !== child) return;
    const wasInitialized = protocol.initialized();
    const requestCount = protocol.messageRequests().length;
    protocol.receive(event.data);
    if (!wasInitialized && protocol.initialized()) {
      protocol.deliverToolResult(fixture(options.fixtures, fixtureName));
    }
    for (const request of protocol.messageRequests().slice(requestCount)) {
      if (messageResponse === "reject") request.reject();
      else request.succeed();
    }
  };
  window.addEventListener("message", receive);

  childDocument.open();
  childDocument.write("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body></body></html>");
  childDocument.close();
  childDocument.title = options.title ?? "MCP App preview";
  childDocument.documentElement.lang = document.documentElement.lang || "en";
  if (reducedMotion) installReducedMotion(child);

  const root = childDocument.createElement("div");
  root.id = options.rootElementId;
  childDocument.body.append(root);
  const script = childDocument.createElement("script");
  script.src = new URL(options.entryPoint, location.href).href;
  childDocument.body.append(script);

  return {
    iframe,
    initialized: protocol.initialized,
    messageRequests: protocol.messageRequests,
    deliverFixture: (name) => protocol.deliverToolResult(fixture(options.fixtures, name)),
    changeHostContext: protocol.changeHostContext,
    setContainerWidth: (nextWidth) => setWidth(iframe, checkedWidth(nextWidth)),
    destroy: () => {
      window.removeEventListener("message", receive);
      iframe.remove();
    },
  };
}

function fixture(fixtures: Readonly<Record<string, unknown>>, name: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(fixtures, name)) {
    throw new TypeError(`Unknown fixture: ${name}`);
  }
  return fixtures[name];
}

function checkedWidth(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const width = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(width) || Number(width) < 200 || Number(width) > 2_000) {
    throw new TypeError("width must be an integer from 200 to 2000");
  }
  return Number(width);
}

function setWidth(iframe: HTMLIFrameElement, width: number | undefined): void {
  iframe.style.width = width === undefined ? "" : `${width}px`;
}

function installReducedMotion(target: Window): void {
  const nativeMatchMedia = target.matchMedia.bind(target);
  Object.defineProperty(target, "matchMedia", {
    configurable: true,
    value: (query: string) => /prefers-reduced-motion\s*:\s*reduce/.test(query)
      ? {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent: () => true,
        }
      : nativeMatchMedia(query),
  });
}
