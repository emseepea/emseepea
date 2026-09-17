import type { McpAppHostContext } from "@emseepea/server/ui";

export interface McpAppHostSimulatorOptions {
  readonly hostContext?: McpAppHostContext;
}

export interface McpAppMessageRequest {
  readonly id: string | number;
  readonly text: string;
  succeed(): void;
  reject(message?: string): void;
}

export interface McpAppHostSimulator {
  /** Pass this window-compatible channel to `createMcpAppController().connect()`. */
  readonly channel: Window;
  initialized(): boolean;
  messageRequests(): readonly McpAppMessageRequest[];
  deliverToolResult(structuredContent: unknown): void;
  changeHostContext(context: Partial<McpAppHostContext>): void;
  cancel(reason?: string): void;
  teardown(reason?: string): Promise<void>;
  /** Deliver an arbitrary message from the trusted parent for negative tests. */
  dispatch(message: unknown): void;
  /** Deliver an arbitrary message from a different source for trust-boundary tests. */
  dispatchUntrusted(message: unknown): void;
}

export interface McpAppHostProtocol {
  initialized(): boolean;
  messageRequests(): readonly McpAppMessageRequest[];
  deliverToolResult(structuredContent: unknown): void;
  changeHostContext(context: Partial<McpAppHostContext>): void;
  cancel(reason?: string): void;
  teardown(reason?: string): Promise<void>;
  receive(message: unknown): void;
}

type JsonRpcResponse = {
  readonly result?: unknown;
  readonly error?: unknown;
};

/** Deterministic, framework-neutral simulation of the MCP Apps browser host lifecycle. */
export function createMcpAppHostSimulator(
  options: McpAppHostSimulatorOptions = {},
): McpAppHostSimulator {
  const events = new EventTarget();
  const parent = {
    postMessage(message: unknown) {
      protocol.receive(message);
    },
  };
  const untrusted = {};
  const channel = {
    parent,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Window;

  function dispatch(message: unknown, source: object = parent): void {
    const event = new Event("message");
    Object.defineProperties(event, {
      data: { value: message },
      source: { value: source },
    });
    events.dispatchEvent(event);
  }

  const protocol = createMcpAppHostProtocol(options, (message) => dispatch(message));

  return {
    channel,
    initialized: protocol.initialized,
    messageRequests: protocol.messageRequests,
    deliverToolResult: protocol.deliverToolResult,
    changeHostContext: protocol.changeHostContext,
    cancel: protocol.cancel,
    teardown: protocol.teardown,
    dispatch: (message) => dispatch(message),
    dispatchUntrusted: (message) => dispatch(message, untrusted),
  };
}

/** @internal Shared protocol engine for deterministic and browser hosts. */
export function createMcpAppHostProtocol(
  options: McpAppHostSimulatorOptions,
  send: (message: unknown) => void,
): McpAppHostProtocol {
  const requests: McpAppMessageRequest[] = [];
  const responses = new Map<string | number, JsonRpcResponse>();
  let initialized = false;
  let sequence = 0;

  const receive = (message: unknown) => {
    if (!record(message) || message.jsonrpc !== "2.0") return;
    if ((typeof message.id === "string" || typeof message.id === "number") &&
        (record(message.result) || record(message.error))) {
      responses.set(message.id, {
        ...(message.result !== undefined ? { result: message.result } : {}),
        ...(message.error !== undefined ? { error: message.error } : {}),
      });
      return;
    }
    if (message.method === "ui/initialize" &&
        (typeof message.id === "string" || typeof message.id === "number")) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2026-01-26",
          hostInfo: { name: "emseepea-test-host", version: "0.0.0" },
          hostCapabilities: {},
          hostContext: options.hostContext ?? {},
        },
      });
      return;
    }
    if (message.method === "ui/notifications/initialized") {
      initialized = true;
      return;
    }
    if (message.method !== "ui/message" ||
        (typeof message.id !== "string" && typeof message.id !== "number") ||
        !record(message.params) || message.params.role !== "user" ||
        !Array.isArray(message.params.content) || message.params.content.length !== 1 ||
        !record(message.params.content[0]) || message.params.content[0].type !== "text" ||
        typeof message.params.content[0].text !== "string") return;

    const id = message.id;
    let settled = false;
    const answer = (response: JsonRpcResponse) => {
      if (settled) throw new Error("The ui/message request has already been answered.");
      settled = true;
      send({ jsonrpc: "2.0", id, ...response });
    };
    requests.push(Object.freeze({
      id,
      text: message.params.content[0].text,
      succeed: () => answer({ result: {} }),
      reject: (reason = "The test host rejected the message.") => answer({
        error: { code: -32_000, message: reason },
      }),
    }));
  };

  return {
    initialized: () => initialized,
    messageRequests: () => Object.freeze([...requests]),
    deliverToolResult: (structuredContent) => send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent },
    }),
    changeHostContext: (context) => send({
      jsonrpc: "2.0",
      method: "ui/notifications/host-context-changed",
      params: context,
    }),
    cancel: (reason) => send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-cancelled",
      ...(reason === undefined ? {} : { params: { reason } }),
    }),
    teardown: async (reason) => {
      const id = `emseepea-host-teardown-${++sequence}`;
      responses.delete(id);
      send({
        jsonrpc: "2.0",
        id,
        method: "ui/resource-teardown",
        params: reason === undefined ? {} : { reason },
      });
      const response = responses.get(id);
      responses.delete(id);
      if (!response) throw new Error("The app did not answer resource teardown.");
      if (response.error !== undefined) throw new Error("The app rejected resource teardown.");
    },
    receive,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
