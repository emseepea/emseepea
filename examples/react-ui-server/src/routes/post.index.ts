import type { HttpRouteHandler } from "@emseepea/server";

import { submittedView } from "../ui.js";

export default (async (request, reply) => {
  await reply.type("application/json; charset=utf-8").send(submittedView(request.body));
}) satisfies HttpRouteHandler;
