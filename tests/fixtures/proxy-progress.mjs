import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

export async function startCluster() {
  const children = [];
  const proxy = createServer();
  let next = 0;
  const forwarding = { "x-forwarded-proto": "https", "x-forwarded-for": "192.0.2.1" };
  try {
    for (const instance of ["one", "two"]) children.push(await startChild(instance));
    proxy.on("request", (incoming, outgoing) => {
      const target = children[next++ % children.length].url;
      const upstream = request(new URL(incoming.url, target), {
        method: incoming.method,
        headers: { ...incoming.headers, host: "api.example", ...forwarding },
      });
      upstream.setTimeout(8_000, () => upstream.destroy(new Error("proxy timeout")));
      upstream.on("response", (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.on("error", () => outgoing.destroy());
        response.pipe(outgoing);
        outgoing.once("close", () => response.destroy());
      });
      upstream.on("error", () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
      });
      incoming.on("error", () => upstream.destroy());
      incoming.once("aborted", () => upstream.destroy());
      outgoing.once("close", () => { if (!outgoing.writableFinished) upstream.destroy(); });
      incoming.pipe(upstream);
    });
    proxy.listen(0, "127.0.0.1");
    await once(proxy, "listening");
    return {
      url: new URL(`http://127.0.0.1:${proxy.address().port}/mcp`),
      forwarding,
      stats: () => Promise.all(children.map((child) => child.ask("stats"))),
      release: (id) => Promise.all(children.map((child) => child.ask("release", id))),
      async close() {
        proxy.closeAllConnections();
        await new Promise((resolve) => proxy.close(resolve));
        await Promise.all(children.map((child) => child.close()));
      },
    };
  } catch (error) {
    proxy.closeAllConnections(); proxy.close();
    await Promise.allSettled(children.map((child) => child.close()));
    throw error;
  }
}

async function startChild(instance) {
  const child = fork(new URL("./proxy-progress-server.mjs", import.meta.url), [instance], {
    execArgv: ["--expose-gc", "--max-old-space-size=192"],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  let sequence = 0;
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  function receive(send, matches) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error("fixture IPC timeout")), 8_000);
      const onExit = () => finish(new Error(`fixture ${instance} exited unexpectedly`));
      const onError = (error) => finish(error);
      const onMessage = (message) => {
        if (matches(message)) finish(message.error ? new Error(message.error) : undefined, message);
      };
      function finish(error, message) {
        clearTimeout(timer);
        child.off("message", onMessage); child.off("exit", onExit); child.off("error", onError);
        if (error) reject(error); else resolve(message);
      }
      child.on("message", onMessage); child.once("exit", onExit); child.once("error", onError);
      if (child.exitCode !== null || child.signalCode !== null) onExit();
      else send?.((error) => { if (error) finish(error); });
    });
  }
  const ask = async (type, id) => {
    const current = ++sequence;
    const message = await receive(
      (callback) => child.send({ sequence: current, type, id }, callback),
      (reply) => reply.sequence === current,
    );
    return message.value;
  };
  try {
    const ready = await receive(undefined, (message) => message.type === "ready");
    return {
      url: new URL(ready.url), ask,
      async close() {
        let timer;
        try {
          await ask("shutdown");
          const result = await Promise.race([exited, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("fixture shutdown timeout")), 5_000);
          })]);
          assert.deepEqual(result, { code: 0, signal: null });
        } finally {
          clearTimeout(timer);
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }
      },
    };
  } catch (error) { child.kill("SIGKILL"); throw error; }
}

export function callOptions(id, mode = "normal", { signal, token = true, headers = {}, name = "progress" } = {}) {
  return {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    headers: {
      Accept: "application/json, text/event-stream", "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": name, ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: {
      name, arguments: name === "progress" ? { id, mode } : {},
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "proxy-test", version: "0.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {}, ...(token ? { progressToken: id } : {}),
      },
    } }),
  };
}

export async function readMessages(response, onMessage = () => {}) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  const messages = [];
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    assert.ok(bytes <= 1_400_000, "stream exceeds combined response budget");
    buffer += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      assert.ok(frame.startsWith("event: message\n"), "unexpected SSE frame");
      const message = JSON.parse(frame.slice(frame.indexOf("data: ") + 6));
      assert.ok(!messages.some((previous) => "result" in previous || "error" in previous), "post-terminal event");
      messages.push(message);
      await onMessage(message);
    }
  }
  buffer += decoder.decode();
  assert.equal(buffer, "", "truncated SSE frame");
  return messages;
}

export function checkMessages(messages, id, mode = "normal") {
  const error = ["event-size", "event-count", "result-size", "timeout"].includes(mode);
  const count = ["event-size", "timeout"].includes(mode) ? 1 : ["burst", "event-count"].includes(mode) ? 32 : 3;
  assert.equal(messages.length, count + 1, `missing or extra events: ${mode}`);
  const instance = messages[0].params.message.split(":")[0];
  assert.ok(["one", "two"].includes(instance));
  for (const [index, message] of messages.slice(0, -1).entries()) {
    assert.equal(message.method, "notifications/progress");
    assert.equal(message.params.progressToken, id);
    assert.equal(message.params.progress, index + 1);
    assert.equal(message.params.message, `${instance}:${id}:` + (mode === "burst" ? "x".repeat(7_000) : "stage"));
    assert.ok(Buffer.byteLength(JSON.stringify({ method: message.method, params: message.params })) <= 8_192);
  }
  const final = messages.at(-1);
  assert.ok(Buffer.byteLength(JSON.stringify(final.result)) <= 1_048_576);
  assert.equal(final.id, id);
  assert.equal(final.result.isError, error);
  if (!error) assert.deepEqual(final.result.structuredContent, {
    id, instance, padding: mode === "burst" ? "x".repeat(900_000) : "",
  });
  else assert.equal(final.result.content[0].text, "Tool execution failed");
  return instance;
}

export async function checkedCall(cluster, id, mode = "normal", onMessage) {
  return checkMessages(await readMessages(await fetch(cluster.url, callOptions(id, mode)), onMessage), id, mode);
}

export async function waitForIdle(cluster, expectedCancelled) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const stats = await cluster.stats();
    if (stats.every((entry) => entry.active === 0) &&
        stats.reduce((sum, entry) => sum + entry.cancelled, 0) === expectedCancelled) return stats;
    await delay(20);
  }
  assert.fail("server work did not stop after cancellation");
}

export async function disconnectCall(cluster, id) {
  const controller = new AbortController();
  const response = await fetch(cluster.url, callOptions(id, "disconnect", { signal: controller.signal }));
  await assert.rejects(readMessages(response, (message) => {
    assert.equal(message.method, "notifications/progress");
    assert.equal(message.params.progressToken, id);
    assert.equal(message.params.progress, 1);
    assert.match(message.params.message, new RegExp(`^(one|two):${id}:stage$`));
    controller.abort();
  }), /abort/i);
  const until = performance.now() + 1_000;
  while (performance.now() < until) {
    const stopped = (await cluster.stats()).flatMap((entry) => entry.cancelledRequests[id] ?? []);
    if (stopped.length) {
      assert.equal(stopped.length, 1);
      assert.ok(stopped[0].elapsedMs < 1_500, "disconnect was only stopped by the 2-second deadline");
      return;
    }
    await delay(20);
  }
  assert.fail("selected server did not observe disconnect within one second");
}
