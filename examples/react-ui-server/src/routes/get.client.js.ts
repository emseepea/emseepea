import { readFile } from "node:fs/promises";

import type { HttpRouteHandler } from "@emseepea/server";

const client = await readFile(new URL("../client.js", import.meta.url), "utf8");

export default (async (_request, reply) => {
  await reply.type("text/javascript; charset=utf-8").header("cache-control", "no-store").send(client);
}) satisfies HttpRouteHandler;
