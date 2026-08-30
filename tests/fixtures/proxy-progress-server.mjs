import { setTimeout as delay } from "node:timers/promises";
import { createEmseepea, defineStreamingTool, defineTool, serveEmseepea } from "@emseepea/server";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { z } from "zod";

const instance = process.argv[2];
const waiting = new Map();
let calls = 0;
let active = 0;
let cancelled = 0;
let protectedCalls = 0;
const cancelledRequests = {};
let peakRss = 0;
let samples = 0;
const sample = () => { samples++; peakRss = Math.max(peakRss, process.memoryUsage().rss); };
const sampler = setInterval(sample, 10);
sampler.unref();

const tool = defineStreamingTool({
  name: "progress", access: "public", description: "Report request-specific progress.",
  inputSchema: z.object({ id: z.string(), mode: z.enum([
    "normal", "gated", "disconnect", "timeout", "event-size", "event-count", "result-size", "burst",
  ]) }),
  outputSchema: z.object({ id: z.string(), instance: z.string(), padding: z.string() }),
  async handler({ id, mode }, { reportProgress, signal }) {
    const started = performance.now();
    calls++; active++;
    try {
      const count = mode === "burst" || mode === "event-count" ? 32 : 3;
      const message = `${instance}:${id}:` + (mode === "burst" ? "x".repeat(7_000) : "stage");
      for (let progress = 1; progress <= count; progress++) {
        await reportProgress({ progress, total: count, message });
        if (progress === 1) {
          if (mode === "gated") {
            await new Promise((resolve, reject) => {
              const abort = () => reject(new Error("cancelled"));
              signal.addEventListener("abort", abort, { once: true });
              waiting.set(id, () => { signal.removeEventListener("abort", abort); resolve(); });
              if (signal.aborted) abort();
            });
          }
          if (mode === "timeout" || mode === "disconnect") await delay(30_000, undefined, { signal });
          if (mode === "event-size") await reportProgress({ progress: 2, total: 3, message: "x".repeat(8_192) });
        }
      }
      if (mode === "event-count") await reportProgress({ progress: 33, total: 33, message });
      return {
        text: "complete",
        data: { id, instance, padding: "x".repeat(mode === "burst" ? 900_000 : mode === "result-size" ? 1_048_576 : 0) },
      };
    } finally {
      if (signal.aborted) {
        cancelled++;
        cancelledRequests[id] = { elapsedMs: performance.now() - started };
      }
      waiting.delete(id);
      active--; sample();
    }
  },
});
const signedIn = defineTool({
  name: "signed-in", access: "protected", requiredScopes: ["read"],
  description: "Return a result after sign-in.", inputSchema: z.object({}),
  outputSchema: z.object({ instance: z.string() }),
  handler: () => { protectedCalls++; return { text: "ok", data: { instance } }; },
});
const running = await serveEmseepea(createEmseepea({
  name: `proxy-test-${instance}`, version: "0.0.0", tools: [tool, signedIn],
  operationTimeoutMs: 2_000,
  oauth: {
    verifier: {
      async verifyAccessToken(token) {
        if (token !== "test-valid") throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid");
        return { token, clientId: "test", scopes: ["read"], expiresAt: Math.floor(Date.now() / 1_000) + 60,
          resource: new URL("https://api.example/mcp") };
      },
    },
    metadata: {
      resourceServerUrl: new URL("https://api.example/mcp"),
      oauthMetadata: { issuer: "https://auth.example", authorization_endpoint: "https://auth.example/authorize",
        token_endpoint: "https://auth.example/token", response_types_supported: ["code"] },
    },
  },
  deployment: {
    mode: "production-behind-proxy", allowedAuthorities: ["api.example"],
    allowedOrigins: ["https://api.example"], trustedProxyAddresses: ["127.0.0.1"],
    rateLimit: { maxRequests: 10_000, windowMs: 60_000, maxClients: 4 },
  },
}), { port: 0 });

process.on("message", async ({ sequence, type, id }) => {
  try {
    let value;
    if (type === "release") waiting.get(id)?.();
    else if (type === "stats") {
      sample();
      globalThis.gc?.();
      value = { instance, calls, active, cancelled, cancelledRequests, protectedCalls, peakRss, samples,
        heap: process.memoryUsage().heapUsed };
    } else if (type === "shutdown") {
      await running.close();
      clearInterval(sampler);
    } else throw new Error("Unknown fixture command");
    process.send({ sequence, value });
    if (type === "shutdown") process.disconnect();
  } catch (error) { process.send({ sequence, error: String(error) }); }
});
process.send({ type: "ready", url: running.url.href, instance });
