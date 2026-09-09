import {
  createEmseepea,
  discoverCapabilities,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";

export interface BackendExampleOptions extends EmseepeaExtensions {
  readonly access?: AccessPolicy;
}

export async function createBackendExample(
  client: JsonHttpClient,
  options: BackendExampleOptions = {},
): Promise<ReturnType<typeof createEmseepea>> {
  const { access = { access: "public" }, ...extensions } = options;
  return createEmseepea({
    name: "emseepea-api-backed-server",
    version: "0.0.0",
    instructions: "Use search-pea-taxa to search iNaturalist's public taxon catalogue for pea species.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), { client, access }),
    ...extensions,
  });
}
