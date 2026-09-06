import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";
import { z } from "zod";

export interface BackendExampleContext { readonly client: JsonHttpClient }

const backendTaxon = z.object({
  id: z.number().int().positive().describe("iNaturalist identifier for the taxon."),
  name: z.string().min(1).max(200).describe("Scientific name of the taxon."),
  preferred_common_name: z.string().min(1).max(200).nullable().optional()
    .describe("Preferred common name when iNaturalist provides one."),
  rank: z.string().min(1).max(40).describe("Taxonomic rank reported by iNaturalist."),
  observations_count: z.number().int().nonnegative()
    .describe("Recorded iNaturalist observations, not an estimate of the wild population."),
});
const inputSchema = z.object({
  query: z.string().trim().min(2).max(80).describe("Pea name or other taxon search terms."),
});
const backendPayload = z.object({
  total_results: z.number().int().nonnegative().describe("Total matching taxa reported by iNaturalist."),
  results: z.array(backendTaxon).max(5).describe("Up to five matching taxa."),
});
const outputSchema = backendPayload.extend({
  query: z.string().max(80).describe("Trimmed search terms sent to iNaturalist."),
  source: z.literal("iNaturalist").describe("Data provider for these results."),
  source_url: z.literal("https://www.inaturalist.org").describe("Website of the data provider."),
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
