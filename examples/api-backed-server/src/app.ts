import { createEmseepea, discoverCapabilities } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";

export async function createBackendExample(client: JsonHttpClient): Promise<ReturnType<typeof createEmseepea>> {
  return createEmseepea({
    name: "emseepea-api-backed-server",
    version: "0.0.0",
    instructions: "Use search-pea-taxa to search iNaturalist's public taxon catalogue for pea species.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), { client }),
  });
}
