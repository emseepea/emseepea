import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request } from "node:http";
import test from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { serveEmseepea } from "@emseepea/server";
import {
  insecureTestAuthentication,
  startEmseepea,
  startMcpServer,
} from "@emseepea/testing";
import { createProgressStreamingServer } from "../dist/app.js";

test("reports bounded progress before returning the final germination result", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const tool = (await client.listTools()).tools[0];
  assert.equal(tool.inputSchema.properties.tray.description, "Sample germination tray to test.");
  assert.equal(tool.outputSchema.properties.tray.description, "Germination tray that was tested.");
  assert.equal(tool.outputSchema.properties.status.description, "Final state of the germination trial.");
  assert.equal(tool.outputSchema.properties.germinatedSeeds.description, "Number of seeds that germinated.");
  assert.equal(tool.outputSchema.properties.totalSeeds.description, "Total number of seeds in the trial.");
  assert.equal(tool.outputSchema.properties.stages.description, "Trial stages completed in order.");
  const progress = [];
  const result = await client.callTool(
    { name: "run-germination-trial", arguments: { tray: "sample-tray" } },
    { onprogress: (update) => progress.push(update) },
  );

  assert.deepEqual(progress.map(({ message }) => message), ["soak", "sow", "sprout"]);
  assert.deepEqual(result.structuredContent, {
    tray: "sample-tray",
    status: "complete",
    germinatedSeeds: 8,
    totalSeeds: 10,
    stages: ["soak", "sow", "sprout"],
  });
  assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
});

test("the same template composes protected access and observability", async (t) => {
  const events = [];
  const permissions = ["trials:run"];
  const running = await startEmseepea(t, await createProgressStreamingServer({
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions),
    observability: [{ id: "test-log", emit: (event) => events.push(event) }],
  }));
  const client = await running.connect("test-token");
  const progress = [];
  const result = await client.callTool(
    { name: "run-germination-trial", arguments: { tray: "sample-tray" } },
    { onprogress: (update) => progress.push(update) },
  );
  assert.deepEqual(progress.map(({ message }) => message), ["soak", "sow", "sprout"]);
  assert.equal(result.structuredContent.status, "complete");
  assert.ok(events.some(({ capability }) => capability === "run-germination-trial"));
});

test("protected progress crosses a trusted proxy through official and raw clients", async (t) => {
  const permissions = ["trials:run"];
  const backend = await serveEmseepea(await createProgressStreamingServer({
    access: { access: "protected", requiredScopes: permissions },
    authentication: insecureTestAuthentication(permissions, "public"),
    deployment: {
      mode: "production-behind-proxy",
      trustedProxyAddresses: ["127.0.0.1"],
      allowedAuthorities: ["test.example"],
      allowedOrigins: ["https://test.example"],
      rateLimit: { maxRequests: 20, windowMs: 1_000, maxClients: 1 },
    },
  }), { port: 0 });
  const proxy = await startTrustedProxy(backend.url);
  t.after(async () => {
    proxy.closeAllConnections();
    await new Promise((resolve) => proxy.close(resolve));
    await backend.close();
  });
  const url = new URL(`http://127.0.0.1:${proxy.address().port}/mcp`);

  const client = new Client(
    { name: "packed-progress-test", version: "0.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  try {
    await client.connect(new StreamableHTTPClientTransport(url, {
      requestInit: { headers: {
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer official-token",
      } },
    }));
    const progress = [];
    const result = await client.callTool(
      { name: "run-germination-trial", arguments: { tray: "sample-tray" } },
      { onprogress: (update) => progress.push(update) },
    );
    assert.ok(proxy.requestBodies.some((body) => body.includes('"progressToken"')));
    assert.equal(proxy.responseTypes.at(-1), "text/event-stream");
    assert.deepEqual(progress.map(({ message }) => message), ["soak", "sow", "sprout"]);
    assert.equal(result.structuredContent.tray, "sample-tray");
  } finally {
    await client.close();
  }

  const response = await fetch(url, rawCall("raw-token"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  const messages = (await response.text()).trim().split("\n\n").map((frame) =>
    JSON.parse(frame.slice(frame.indexOf("data: ") + 6)));
  assert.deepEqual(messages.slice(0, -1).map(({ params }) => params.message), ["soak", "sow", "sprout"]);
  assert.equal(messages.at(-1).result.structuredContent.tray, "sample-tray");
  assert.doesNotMatch(JSON.stringify(messages), /raw-token/);
});

async function startTrustedProxy(backendUrl) {
  const requestBodies = [];
  const responseTypes = [];
  const proxy = createServer((incoming, outgoing) => {
    const chunks = [];
    incoming.on("data", (chunk) => chunks.push(chunk));
    incoming.on("end", () => requestBodies.push(Buffer.concat(chunks).toString("utf8")));
    const upstream = request(new URL(incoming.url, backendUrl), {
      method: incoming.method,
      headers: {
        ...incoming.headers,
        host: "test.example",
        "x-forwarded-for": "192.0.2.1",
        "x-forwarded-proto": "https",
      },
    });
    upstream.on("response", (response) => {
      responseTypes.push(response.headers["content-type"]);
      outgoing.writeHead(response.statusCode, response.headers);
      response.pipe(outgoing);
    });
    upstream.on("error", () => outgoing.destroy());
    incoming.pipe(upstream);
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  proxy.requestBodies = requestBodies;
  proxy.responseTypes = responseTypes;
  return proxy;
}

function rawCall(token) {
  return {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "run-germination-trial",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "raw-call",
      method: "tools/call",
      params: {
        name: "run-germination-trial",
        arguments: { tray: "sample-tray" },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "raw-progress-test", version: "0.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
          progressToken: "raw-progress",
        },
      },
    }),
  };
}
