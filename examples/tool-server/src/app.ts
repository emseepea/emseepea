import {
  createEmseepea,
  discoverCapabilities,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";

export interface ToolServerOptions extends EmseepeaExtensions {
  readonly access?: AccessPolicy;
}

export async function createToolServer(options: ToolServerOptions = {}) {
  const { access = { access: "public" }, ...extensions } = options;
  return createEmseepea({
    name: "emseepea-tool-server",
    version: "0.0.0",
    instructions: "Use get-pea-variety for information about a sample pea variety.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), access),
    ...extensions,
  });
}
