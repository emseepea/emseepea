import {
  createEmseepea,
  discoverCapabilities,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";

export interface ProgressStreamingServerOptions extends EmseepeaExtensions {
  readonly access?: AccessPolicy;
}

export async function createProgressStreamingServer(options: ProgressStreamingServerOptions = {}) {
  const { access = { access: "public" }, ...extensions } = options;
  return createEmseepea({
    name: "emseepea-progress-streaming-server",
    version: "0.0.0",
    instructions: "Use run-germination-trial for the sample pea germination trial.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), access),
    ...extensions,
  });
}
