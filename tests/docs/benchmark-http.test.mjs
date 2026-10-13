import assert from "node:assert/strict";
import { createServer, get } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { readBenchmarkResponse } from "../../benchmarks/benchmark-http.mjs";

test("mid-response cancellation rejects rather than leaving a benchmark pending", async (t) => {
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-length": "10000" });
    response.write("partial");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = get(`http://127.0.0.1:${server.address().port}`);
  const [response] = await once(request, "response");
  const body = readBenchmarkResponse(response);
  server.closeAllConnections();
  await assert.rejects(body, /aborted/);
});
