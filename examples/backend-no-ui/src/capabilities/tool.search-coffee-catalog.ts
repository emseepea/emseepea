import { defineMappedTool, type CapabilityModuleFactory } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";
import { z } from "zod";

export interface BackendExampleContext { readonly client: JsonHttpClient }

const roastLevel = z.string().trim().min(1).max(40);
const searchInput = z.object({
  query: z.string().trim().min(2).max(80),
  roastLevel: roastLevel.describe("Optional BrewMark roast level, such as LIGHT or MEDIUM_LIGHT.").optional(),
});
const coffee = z.object({
  name: z.string().max(200), roasterName: z.string().max(200), roastLevel,
  origin: z.string().max(200).nullable(), processingMethod: z.string().max(100).nullable(),
  flavorProfile: z.string().max(500).nullable(), acidityLevel: z.number().int().min(1).max(5).nullable(),
  bodyLevel: z.number().int().min(1).max(5).nullable(),
});
const searchReport = z.object({
  query: z.string().max(80), roastLevelFilter: roastLevel.nullable(), returnedCount: z.number().int().min(0).max(5),
  moreMatchesAvailable: z.boolean(),
  ratingScale: z.object({
    acidity: z.literal("1 = low acidity; 5 = high acidity"),
    body: z.literal("1 = light body; 5 = full body"),
  }),
  coffees: z.array(coffee).max(5), source: z.literal("BrewMark"), sourceUrl: z.literal("https://brewmark.io"),
});
const backendCommand = z.object({
  pathname: z.literal("/api/coffees"),
  searchParams: z.object({
    q: z.string().min(2).max(80), roastLevel: roastLevel.optional(),
    sort: z.literal("alpha"), limit: z.literal("5"),
  }),
});
const backendCoffee = z.object({
  name: z.string().max(200), roasterName: z.string().max(200), roastLevel,
  origin: z.string().max(200).nullable(), processingMethod: z.string().max(100).nullable(),
  flavorProfile: z.string().max(500).nullable(), acidityLevel: z.number().int().min(1).max(5).nullable(),
  bodyLevel: z.number().int().min(1).max(5).nullable(),
});
const backendPayload = z.object({
  data: z.array(backendCoffee).max(5), cursor: z.string().max(2_048).nullable(), hasMore: z.boolean(),
});
const backendResult = z.object({ request: backendCommand, payload: backendPayload });

export default (({ client }) => defineMappedTool({
  name: "search-coffee-catalog",
  access: "public",
  description: "Search BrewMark's public coffee catalogue and explain its acidity and body ratings.",
  inputSchema: searchInput,
  outputSchema: searchReport,
  backendInputSchema: backendCommand,
  backendOutputSchema: backendResult,
  mapInput: ({ query, roastLevel }) => ({
    pathname: "/api/coffees" as const,
    searchParams: {
      q: query,
      ...(roastLevel ? { roastLevel } : {}),
      sort: "alpha" as const,
      limit: "5" as const,
    },
  }),
  async adapter(request, { signal, deadlineMs }) {
    return { request, payload: await client.get({ ...request, signal, deadlineMs }) };
  },
  mapOutput: ({ request, payload }) => {
    const coffees = payload.data.map((record) => ({
      name: record.name, roasterName: record.roasterName, roastLevel: record.roastLevel,
      origin: record.origin, processingMethod: record.processingMethod,
      flavorProfile: record.flavorProfile, acidityLevel: record.acidityLevel, bodyLevel: record.bodyLevel,
    }));
    const data = {
      query: request.searchParams.q,
      roastLevelFilter: request.searchParams.roastLevel ?? null,
      returnedCount: coffees.length,
      moreMatchesAvailable: payload.hasMore,
      ratingScale: {
        acidity: "1 = low acidity; 5 = high acidity" as const,
        body: "1 = light body; 5 = full body" as const,
      },
      coffees,
      source: "BrewMark" as const,
      sourceUrl: "https://brewmark.io" as const,
    };
    const lines = coffees.map((record) => [
      `${record.name} by ${record.roasterName}`,
      `origin: ${record.origin ?? "not provided"}`,
      `roast level: ${record.roastLevel}`,
      `acidity: ${record.acidityLevel ?? "not provided"}`,
      `body: ${record.bodyLevel ?? "not provided"}`,
    ].join("; "));
    return {
      text: [
        `BrewMark returned ${coffees.length} coffee${coffees.length === 1 ? "" : "s"} for “${data.query}”.`,
        `More matches available: ${data.moreMatchesAvailable ? "yes" : "no"}.`,
        "Acidity: 1 = low acidity; 5 = high acidity.",
        "Body: 1 = light body; 5 = full body.",
        ...lines,
        "Source: https://brewmark.io",
      ].join("\n"),
      data,
    };
  },
})) satisfies CapabilityModuleFactory<BackendExampleContext>;
