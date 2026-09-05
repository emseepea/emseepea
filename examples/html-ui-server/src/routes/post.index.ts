import type { HttpRouteHandler } from "@emseepea/server";

import { pageFromSubmission } from "../ui.js";

export default (async (request, reply) => {
  await reply.type("text/html; charset=utf-8").send(pageFromSubmission(request.body));
}) satisfies HttpRouteHandler;
