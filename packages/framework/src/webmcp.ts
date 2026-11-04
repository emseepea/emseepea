/** Browser-only entry point: no server or transport runtime is imported. */
export interface McpWebTool {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly inputSchema: { readonly type: "object"; readonly [key: string]: unknown };
  readonly outputSchema?: unknown;
  readonly annotations?: { readonly readOnlyHint?: boolean; readonly [key: string]: unknown };
}

export interface McpWebResult {
  readonly content: readonly unknown[];
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
}

/** The caller owns connection, authentication, endpoint selection and closing. */
export interface McpWebClient {
  listTools(params?: { cursor?: string }, options?: McpWebRequestOptions):
    Promise<{ tools: readonly McpWebTool[]; nextCursor?: string }>;
  callTool(params: { name: string; arguments: Record<string, unknown> }, options?: McpWebRequestOptions):
    Promise<McpWebResult>;
}

export interface McpWebRequestOptions {
  readonly signal?: AbortSignal;
}

export interface WebMcpTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: McpWebTool["inputSchema"];
  readonly annotations: {
    readonly readOnlyHint?: boolean;
    readonly consequentialHint: boolean;
    readonly untrustedContentHint: true;
  };
  readonly execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<string>;
}

/** Structural subset of the experimental browser API. */
export interface WebMcpModelContext {
  getTools(): Promise<readonly { name: string }[]>;
  registerTool(tool: WebMcpTool, options: { signal: AbortSignal }): Promise<void>;
}

export interface RegisterWebMcpOptions {
  readonly client: McpWebClient;
  readonly modelContext?: WebMcpModelContext;
  /** All discovered tools are selected when this predicate is absent. */
  readonly filter?: (tool: McpWebTool) => boolean;
  readonly signal?: AbortSignal;
}

export type WebMcpRegistration =
  | { readonly available: false }
  | {
    readonly available: true;
    readonly tools: readonly string[];
    /** MCP outputSchema describes structuredContent, not the complete result. */
    readonly unsupported: readonly { readonly tool: string; readonly capability: "outputSchema" }[];
    readonly dispose: () => void;
  };

/** Register the client-visible catalogue. Dispose before account/client changes. */
export async function registerWebMcp(options: RegisterWebMcpOptions): Promise<WebMcpRegistration> {
  const modelContext = options.modelContext ?? (typeof document === "undefined" ? undefined :
    (document as Document & { modelContext?: WebMcpModelContext }).modelContext);
  if (!modelContext) return { available: false };
  const lifetime = new AbortController();
  const signal = options.signal ? AbortSignal.any([lifetime.signal, options.signal]) : lifetime.signal;
  try {
    const tools: McpWebTool[] = [];
    const names = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await run(signal, (requestSignal) => options.client.listTools(
        cursor === undefined ? undefined : { cursor }, { signal: requestSignal },
      ));
      for (const tool of page.tools) {
        if (names.has(tool.name)) throw new Error("Duplicate MCP tool name.");
        names.add(tool.name);
        const snapshot = JSON.parse(json(tool)) as McpWebTool;
        if (!options.filter || options.filter(snapshot)) tools.push(snapshot);
      }
      cursor = page.nextCursor;
      if (cursor !== undefined) {
        if (cursors.has(cursor)) throw new Error("Repeated MCP catalogue cursor.");
        cursors.add(cursor);
      }
    } while (cursor !== undefined);

    const registered = await run(signal, () => modelContext.getTools());
    if (tools.some((tool) => registered.some(({ name }) => name === tool.name))) {
      throw new Error("WebMCP tool name collision.");
    }
    for (const tool of tools) {
      const readOnly = tool.annotations?.readOnlyHint;
      await run(signal, () => modelContext.registerTool({
        name: tool.name,
        ...(tool.title === undefined ? {} : { title: tool.title }),
        description: tool.description ?? tool.title ?? tool.name,
        inputSchema: tool.inputSchema,
        annotations: {
          ...(readOnly === undefined ? {} : { readOnlyHint: readOnly }),
          consequentialHint: readOnly !== true,
          untrustedContentHint: true,
        },
        async execute(input, execution) {
          const callSignal = execution?.signal ? AbortSignal.any([signal, execution.signal]) : signal;
          if (callSignal.aborted) return failure("not-dispatched");
          let args: Record<string, unknown>;
          try {
            if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input");
            args = JSON.parse(json(input)) as Record<string, unknown>;
          } catch { return failure("not-dispatched"); }
          let dispatched = false;
          try {
            return await run(callSignal, async (requestSignal) => {
              requestSignal.throwIfAborted();
              dispatched = true;
              return json(await options.client.callTool({ name: tool.name, arguments: args },
                { signal: requestSignal }));
            });
          } catch { return failure(dispatched ? "unknown" : "not-dispatched"); }
        },
      }, { signal }));
    }
    signal.throwIfAborted();
    return {
      available: true,
      tools: Object.freeze(tools.map(({ name }) => name)),
      unsupported: Object.freeze(tools.filter((tool) => tool.outputSchema !== undefined)
        .map(({ name }) => Object.freeze({ tool: name, capability: "outputSchema" as const }))),
      dispose: () => lifetime.abort(),
    };
  } catch {
    lifetime.abort();
    throw new Error("WebMCP registration failed. Check browser support, catalogue names and the client session.");
  }
}

function json(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("Expected JSON.");
  return result;
}

function failure(outcome: "unknown" | "not-dispatched"): string {
  return JSON.stringify({ isError: true, outcome, content: [{ type: "text", text: outcome === "unknown"
    ? "The server outcome is unknown. The operation may have completed. Do not automatically retry."
    : "No MCP call was dispatched. Check the input and active client session." }] });
}

/** Honor cancellation even when a caller-owned client ignores its signal. */
function run<T>(signal: AbortSignal, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); reject(new Error("WebMCP operation cancelled.")); };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return work(signal); }).then(
      (value) => { cleanup(); resolve(value); },
      (error: unknown) => { cleanup(); reject(error); },
    );
  });
}
