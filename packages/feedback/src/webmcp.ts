/** Browser-only bridge. Keep runtime imports out of this entry point. */
export interface FeedbackMcpTool {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly inputSchema: { readonly type: "object"; readonly [key: string]: unknown };
}

export interface FeedbackMcpResult {
  readonly isError?: boolean;
  readonly content: readonly unknown[];
  readonly structuredContent?: unknown;
}

/** The caller owns connection, endpoint restrictions, authentication and closing. */
export interface FeedbackMcpClient {
  listTools(
    params?: { cursor?: string },
    options?: { signal?: AbortSignal; timeout?: number },
  ): Promise<{ tools: readonly FeedbackMcpTool[]; nextCursor?: string }>;
  callTool(
    params: { name: string; arguments: Record<string, unknown> },
    options?: { signal?: AbortSignal; timeout?: number },
  ): Promise<FeedbackMcpResult>;
}

export interface FeedbackWebMcpTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: FeedbackMcpTool["inputSchema"];
  readonly annotations: {
    readonly readOnlyHint: false;
    readonly consequentialHint: false;
    readonly untrustedContentHint: true;
  };
  readonly execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<string>;
}

/** Structural subset of the experimental document.modelContext API. */
export interface FeedbackModelContext {
  getTools(): Promise<readonly { name: string }[]>;
  registerTool(tool: FeedbackWebMcpTool, options: { signal: AbortSignal }): Promise<void>;
}

export interface FeedbackWebMcpOptions {
  readonly client: FeedbackMcpClient;
  readonly modelContext?: FeedbackModelContext;
  /** Trusted deployment configuration, never a model/user-selected destination. */
  readonly toolName?: string;
  readonly signal?: AbortSignal;
  /** Per-discovery/call deadline, in milliseconds, between 1 and 60,000. */
  readonly timeoutMs?: number;
}

export type FeedbackWebMcpRegistration =
  | { readonly available: false }
  | { readonly available: true; readonly dispose: () => void };

const maximumInputBytes = 65_536;
const maximumResultBytes = 262_144;
const encoder = new TextEncoder();

/**
 * Register one server-defined feedback tool, preserving its active guidance.
 * Dispose before logout/account/client changes. Never closes the supplied client.
 */
export async function registerFeedbackWebMcp(
  options: FeedbackWebMcpOptions,
): Promise<FeedbackWebMcpRegistration> {
  const modelContext = options.modelContext ?? (
    typeof document === "undefined" ? undefined :
      (document as Document & { modelContext?: FeedbackModelContext }).modelContext
  );
  if (!modelContext) return { available: false };
  const name = options.toolName ?? "submit-feedback";
  if (!/^(submit-feedback|submit-[a-z][a-z0-9._-]{0,63}-feedback)$/.test(name)) {
    throw new TypeError("Choose a configured feedback submission tool.");
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new TypeError("Feedback timeout must be between 1 and 60,000 milliseconds.");
  }
  const lifetime = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([lifetime.signal, options.signal]) : lifetime.signal;
  try {
    signal.throwIfAborted();
    const registered = await bounded(() => modelContext.getTools(), signal, timeoutMs);
    if (registered.some((tool) => tool.name === name)) throw new Error("collision");
    const tool = await bounded(async (discoverySignal) => {
      let cursor: string | undefined;
      const seen = new Set<string>();
      for (let page = 0; page < 8; page++) {
        discoverySignal.throwIfAborted();
        const listing = await options.client.listTools(cursor ? { cursor } : undefined,
          { signal: discoverySignal, timeout: timeoutMs });
        if (!Array.isArray(listing.tools) || listing.tools.length > 1_000) throw new Error("catalogue");
        const matches = listing.tools.filter((candidate) => candidate.name === name);
        if (matches.length > 1) throw new Error("duplicate");
        if (matches[0]) return matches[0];
        cursor = listing.nextCursor;
        if (!cursor) break;
        if (cursor.length > 4_096 || seen.has(cursor)) throw new Error("cursor");
        seen.add(cursor);
      }
      throw new Error("missing");
    }, signal, timeoutMs);
    if (!tool.description?.trim() || tool.description.length > 16_384 ||
        tool.inputSchema?.type !== "object") throw new Error("contract");
    // Snapshot only public metadata; never copy client/transport state.
    const inputSchema = JSON.parse(boundedJson(tool.inputSchema, 65_536)) as FeedbackMcpTool["inputSchema"];
    let inFlight = false;
    const definition: FeedbackWebMcpTool = {
      name,
      ...(tool.title ? { title: tool.title } : {}),
      description: tool.description,
      inputSchema,
      annotations: { readOnlyHint: false, consequentialHint: false, untrustedContentHint: true },
      async execute(input, execution) {
        if (signal.aborted) return failure("not-submitted", "Feedback is unavailable for this session.");
        if (inFlight) return failure("not-submitted", "A feedback submission is already in progress.");
        const callSignal = execution?.signal ? AbortSignal.any([signal, execution.signal]) : signal;
        if (callSignal.aborted) return failure("not-submitted", "Feedback submission was cancelled before dispatch.");
        let args: Record<string, unknown>;
        try {
          if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input");
          args = JSON.parse(boundedJson(input, maximumInputBytes)) as Record<string, unknown>;
        } catch {
          return failure("not-submitted", "Feedback input must be a bounded JSON object.");
        }
        inFlight = true;
        let dispatched = false;
        try {
          const result = await bounded(async (requestSignal) => {
            dispatched = true;
            try {
              return await options.client.callTool(
                { name, arguments: args }, { signal: requestSignal, timeout: timeoutMs },
              );
            } finally {
              // A client ignoring cancellation must not admit another concurrent write.
              inFlight = false;
            }
          }, callSignal, timeoutMs);
          if (result.isError) return failure("unknown", "The server did not confirm a feedback receipt.");
          const rawReceipt = result.structuredContent;
          const receipt = rawReceipt && typeof rawReceipt === "object" && !Array.isArray(rawReceipt)
            ? rawReceipt as Record<string, unknown> : undefined;
          if (!receipt || typeof receipt.recordedAt !== "string" ||
              typeof receipt.nextAction !== "string" ||
              (typeof receipt.id !== "string" && typeof receipt.submissionId !== "string")) {
            return failure("unknown", "The server did not return a supported feedback receipt.");
          }
          return boundedJson(result, maximumResultBytes);
        } catch {
          // Transport, validation and cancellation errors may follow a durable write.
          // Never expose raw client errors, assert rollback, or retry the call here.
          return failure("unknown", "Feedback persistence could not be confirmed.");
        } finally {
          if (!dispatched) inFlight = false;
        }
      },
    };
    await bounded(() => modelContext.registerTool(definition, { signal }), signal, timeoutMs);
    signal.throwIfAborted();
    return { available: true, dispose: () => lifetime.abort() };
  } catch {
    lifetime.abort();
    throw new Error("WebMCP feedback registration failed. Check browser support, tool availability and the client session.");
  }
}

function failure(outcome: "not-submitted" | "unknown", message: string): string {
  return JSON.stringify({
    isError: true,
    outcome,
    message,
    nextAction: "Continue the user's original task. Do not claim feedback was recorded. " +
      (outcome === "unknown" ? "It may already have been saved. Do not automatically retry." : "No submission was dispatched by this call."),
  });
}

function boundedJson(value: unknown, maximumBytes: number): string {
  const json = JSON.stringify(value);
  if (typeof json !== "string" || encoder.encode(json).byteLength > maximumBytes) throw new Error("size");
  return json;
}

/** Bound even caller-owned clients that ignore the supplied cancellation signal. */
function bounded<T>(
  work: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs: number,
): Promise<T> {
  signal.throwIfAborted();
  const timeout = new AbortController();
  const combined = AbortSignal.any([signal, timeout.signal]);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const cleanup = () => { clearTimeout(timer); combined.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("Feedback operation cancelled or timed out.")); };
    combined.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { combined.throwIfAborted(); return work(combined); }).then(
      (value) => { cleanup(); resolve(value); },
      (error: unknown) => { cleanup(); reject(error); },
    );
  });
}
