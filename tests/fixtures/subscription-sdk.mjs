import { once } from "node:events";
import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, InMemoryServerEventBus, McpServer } from "@modelcontextprotocol/server";

export function listenOptions(uri, signal) {
  return {
    method: "POST", signal,
    headers: {
      "content-type": "application/json", accept: "application/json, text/event-stream",
      "mcp-method": "subscriptions/listen", "mcp-protocol-version": "2026-07-28",
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "same-id", method: "subscriptions/listen",
      params: {
        notifications: { resourceSubscriptions: [uri], toolsListChanged: true },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "subscription-probe", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  };
}

// Feasibility fixture only. Finite total admission is not rolling backpressure.
export async function startSubscriptionProbe({ maxEvents = 4, maxEventBytes = 256,
  maxUriBytes = 512, maxActive = 16, lifetimeMs = 30_000 } = {}) {
  const bus = new InMemoryServerEventBus();
  const active = new Set();
  const requests = [];
  const app = createMcpFastifyApp({ host: "127.0.0.1", bodyLimit: maxUriBytes * 6 + 4_096 });
  app.post("/mcp", async (request, reply) => {
    const uri = request.body?.params?.notifications?.resourceSubscriptions?.[0];
    if (request.body?.id !== "same-id" || typeof uri !== "string" || Buffer.byteLength(uri) > maxUriBytes) {
      return reply.code(400).send({ error: "Probe input limit" });
    }
    if (active.size >= maxActive) return reply.code(503).send({ error: "Probe capacity limit" });
    let ended = false;
    let detach = () => {};
    const record = {
      uri, admitted: 0, bytes: 0, reason: undefined,
      closed: once(reply.raw, "close"),
      stop(reason) {
        if (ended) return;
        ended = true;
        record.reason = reason;
        detach();
        clearTimeout(timer);
        reply.raw.destroy();
      },
    };
    const timer = setTimeout(() => record.stop("deadline"), lifetimeMs);
    timer.unref();
    active.add(record);
    reply.raw.once("close", () => {
      ended = true;
      detach();
      clearTimeout(timer);
      active.delete(record);
    });
    const boundedBus = {
      publish: (event) => bus.publish(event),
      subscribe(listener) {
        detach = bus.subscribe((event) => {
          // Unrelated events cannot consume this request's allowance.
          if (ended || event.kind !== "resource_updated" || event.uri !== uri) return;
          const frame = `event: message\ndata: ${JSON.stringify({
            jsonrpc: "2.0", method: "notifications/resources/updated",
            params: { uri, _meta: { "io.modelcontextprotocol/subscriptionId": "same-id" } },
          })}\n\n`;
          const bytes = Buffer.byteLength(frame);
          if (bytes > maxEventBytes) return record.stop("event-size");
          if (record.admitted === maxEvents) return record.stop("event-count");
          record.admitted++;
          record.bytes += bytes;
          listener(event);
        });
        return () => { ended = true; detach(); clearTimeout(timer); };
      },
    };
    const handler = createMcpHandler(() => new McpServer(
      { name: "subscription-bounds-probe", version: "0.0.0" },
      { capabilities: { resources: { subscribe: true } }, supportedProtocolVersions: ["2026-07-28"] },
    ), { legacy: "reject", bus: boundedBus, keepAliveMs: 0, maxSubscriptions: 1 });
    record.handler = handler;
    requests.push(record);
    reply.hijack();
    try { await toNodeHandler(handler)(request.raw, reply.raw, request.body); }
    finally {
      // Abort first: SDK cleanup otherwise sends a misleading complete result.
      await record.closed;
      await handler.close();
    }
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  return {
    url: `http://127.0.0.1:${app.server.address().port}/mcp`, bus, active, requests,
    async close() {
      for (const record of active) record.stop("shutdown");
      await Promise.all(requests.map((record) => record.closed));
      app.server.closeAllConnections();
      await app.close();
    },
  };
}
