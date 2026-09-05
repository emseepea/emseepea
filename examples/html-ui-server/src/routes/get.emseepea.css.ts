import { readFile } from "node:fs/promises";

import type { HttpRouteHandler } from "@emseepea/server";

const stylesheet = await readFile(new URL(import.meta.resolve("@emseepea/tailwind/styles.css")), "utf8");

export default (async (_request, reply) => {
  await reply.type("text/css; charset=utf-8").header("cache-control", "no-store").send(stylesheet);
}) satisfies HttpRouteHandler;
