import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";
import { z } from "zod";

export interface BackendExampleContext { readonly client: JsonHttpClient }

const taxon = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  preferred_common_name: z.string().min(1).max(200).nullable().optional(),
  rank: z.string().min(1).max(40),
  observations_count: z.number().int().nonnegative(),
});
const backendTaxon = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  preferred_common_name: z.string().min(1).max(200).nullable().optional(),
  rank: z.string().min(1).max(40),
  observations_count: z.number().int().nonnegative(),
});
const searchInput = z.object({ query: z.string().trim().min(2).max(80) });
const searchReport = z.object({
  query: z.string().max(80),
  total_results: z.number().int().nonnegative(),
  results: z.array(taxon).max(5),
  source: z.literal("iNaturalist"),
  source_url: z.literal("https://www.inaturalist.org"),
});
const backendCommand = z.object({
  pathname: z.literal("/v1/taxa"),
  searchParams: z.object({
    q: z.string().min(2).max(80),
    rank: z.literal("species"),
    per_page: z.literal("5"),
  }),
});
const backendPayload = z.object({
  total_results: z.number().int().nonnegative(),
  results: z.array(backendTaxon).max(5),
});
const backendResult = z.object({ request: backendCommand, payload: backendPayload });

export default (({ client }) => defineMappedTool({
  name: "search-pea-taxa",
  access: "public",
  description: "Search iNaturalist's public taxon catalogue for pea species.",
  inputSchema: searchInput,
  outputSchema: searchReport,
  backendInputSchema: backendCommand,
  backendOutputSchema: backendResult,
  mapInput: ({ query }) => ({
    pathname: "/v1/taxa" as const,
    searchParams: { q: query, rank: "species" as const, per_page: "5" as const },
  }),
  async adapter(request, { signal, deadlineMs }) {
    return { request, payload: await client.get({ ...request, signal, deadlineMs }) };
  },
  mapOutput: ({ request, payload }) => {
    const data = {
      query: request.searchParams.q,
      total_results: payload.total_results,
      results: payload.results.map((record) => ({
        id: record.id,
        name: record.name,
        preferred_common_name: record.preferred_common_name,
        rank: record.rank,
        observations_count: record.observations_count,
      })),
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
