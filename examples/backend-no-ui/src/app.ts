import { createEmseepea, discoverCapabilities } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";

export async function createBackendExample(client: JsonHttpClient): Promise<ReturnType<typeof createEmseepea>> {
  return createEmseepea({
    name: "emseepea-backend-no-ui",
    version: "0.0.0",
    instructions: "Use search-coffee-catalog to search BrewMark's public coffee catalogue.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), { client }),
  });
}
