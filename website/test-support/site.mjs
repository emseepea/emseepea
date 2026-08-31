import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const output = fileURLToPath(new URL("../dist/", import.meta.url));
export const base = "/emseepea/";
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".wasm": "application/wasm" };

export async function serveSite() {
  const files = await readdir(output, { recursive: true });
  const routes = files.filter((file) => file.endsWith("index.html"))
    .map((file) => base + file.replace(/index\.html$/, ""));
  assert.ok(routes.length >= 4, "build the documentation before testing");
  const root = path.resolve(output);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!pathname.startsWith(base)) throw new Error("not a site route");
      const file = path.resolve(root, pathname.slice(base.length) + (pathname.endsWith("/") ? "index.html" : ""));
      if (!file.startsWith(root + path.sep)) throw new Error("outside build output");
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    routes,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
    },
  };
}
