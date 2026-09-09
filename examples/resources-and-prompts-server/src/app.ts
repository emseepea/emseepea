import {
  createEmseepea,
  discoverCapabilities,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";

export interface ResourcesAndPromptsServerOptions extends EmseepeaExtensions {
  readonly access?: AccessPolicy;
}

export async function createResourcesAndPromptsServer(options: ResourcesAndPromptsServerOptions = {}) {
  const { access = { access: "public" }, ...extensions } = options;
  return createEmseepea({
    name: "emseepea-resources-and-prompts-server",
    version: "0.0.0",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), access),
    ...extensions,
  });
}
