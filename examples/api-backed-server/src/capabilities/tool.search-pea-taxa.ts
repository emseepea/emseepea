import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";
import { z } from "zod";

export interface BackendExampleContext { readonly client: JsonHttpClient }

const backendTaxon = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  preferred_common_name: z.string().min(1).max(200).nullable().optional(),
  rank: z.string().min(1).max(40),
  observations_count: z.number().int().nonnegative(),
});
const inputSchema = z.object({ query: z.string().trim().min(2).max(80) });
const backendPayload = z.object({
  total_results: z.number().int().nonnegative(),
  results: z.array(backendTaxon).max(5),
});
const outputSchema = backendPayload.extend({
  query: z.string().max(80),
  source: z.literal("iNaturalist"),
  source_url: z.literal("https://www.inaturalist.org"),
});
const backendInputSchema = z.object({
  pathname: z.literal("/v1/taxa"),
  searchParams: z.object({
    q: z.string().min(2).max(80),
    rank: z.literal("species"),
    per_page: z.literal("5"),
  }),
});
const backendOutputSchema = z.object({ request: backendInputSchema, payload: backendPayload });

export default (({ client }) => defineMappedTool({
  name: "search-pea-taxa",
  access: "public",
  description: "Search iNaturalist's public taxon catalogue for pea species.",
  inputSchema,
  outputSchema,
  backendInputSchema,
  backendOutputSchema,
  mapInput: ({ query }) => ({
    pathname: "/v1/taxa" as const,
    searchParams: { q: query, rank: "species" as const, per_page: "5" as const },
  }),
  async adapter(request, { signal, deadlineMs }) {
    return { request, payload: await client.get({ ...request, signal, deadlineMs }) };
  },
  mapOutput: ({ request, payload }) => {
    const data = {
      ...payload,
      query: request.searchParams.q,
      source: "iNaturalist" as const,
      source_url: "https://www.inaturalist.org" as const,
    };
    const lines = data.results.map((record) => [
      record.preferred_common_name ?? "Common name not provided",
      record.name,
      `rank: ${record.rank}`,
      `recorded observations: ${record.observations_count}`,
    ].join("; "));
    return {
      text: [
        `iNaturalist returned ${data.results.length} of ${data.total_results} matching taxa for “${data.query}”.`,
        "observations_count is the number of recorded observations, not a population estimate.",
        ...lines,
        "Source: https://www.inaturalist.org",
      ].join("\n"),
      data,
    };
  },
})) satisfies CapabilityModuleFactory<BackendExampleContext>;
