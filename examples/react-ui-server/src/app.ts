import { parse } from "node:querystring";
import {
  createEmseepea,
  discoverCapabilities,
  registerRoutes,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";

export interface ReactUiServerOptions extends EmseepeaExtensions {
  readonly access?: AccessPolicy;
}

export async function createReactUiServer(options: ReactUiServerOptions = {}) {
  const { access = { access: "public" }, ...extensions } = options;
  const app = createEmseepea({
    name: "emseepea-react-ui-server",
    version: "0.0.0",
    instructions: "Use preview-planting-plan to preview a sample pea planting plan. It sends and stores nothing.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), access),
    ...extensions,
  });
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => done(null, parse(body.toString())),
  );
  await registerRoutes(app, new URL("./routes/", import.meta.url));
  return app;
}
