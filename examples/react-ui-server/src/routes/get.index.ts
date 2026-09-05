import type { HttpRouteHandler } from "@emseepea/server";

import { pageFromQuery } from "../ui.js";

export default (async (request, reply) => {
  await reply.type("text/html; charset=utf-8").send(pageFromQuery(request.query));
}) satisfies HttpRouteHandler;
