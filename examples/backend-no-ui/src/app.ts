import { createEmseepea, defineMappedTool } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";
import { z } from "zod";

const publicRoast = z.enum(["light", "medium-light", "medium", "medium-dark", "dark"]);
const brewmarkRoast = z.enum(["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"]);
const publicToBrewmarkRoast = {
  light: "LIGHT",
  "medium-light": "MEDIUM_LIGHT",
  medium: "MEDIUM",
  "medium-dark": "MEDIUM_DARK",
  dark: "DARK",
} as const;
const brewmarkToPublicRoast = {
  LIGHT: "light",
  MEDIUM_LIGHT: "medium-light",
  MEDIUM: "medium",
  MEDIUM_DARK: "medium-dark",
  DARK: "dark",
} as const;

const searchInput = z.object({
  query: z.string().trim().min(2).max(80),
  roast: publicRoast.optional(),
});
const coffee = z.object({
  name: z.string().max(200),
  roaster: z.string().max(200),
  origin: z.string().max(200).nullable(),
  roast: publicRoast,
  processingMethod: z.string().max(100).nullable(),
  flavourNotes: z.string().max(500).nullable(),
  acidityLevel: z.number().int().min(1).max(5).nullable(),
  bodyLevel: z.number().int().min(1).max(5).nullable(),
});
const searchReport = z.object({
  query: z.string().max(80),
  roastFilter: publicRoast.nullable(),
  returnedCount: z.number().int().min(0).max(5),
  moreMatchesAvailable: z.boolean(),
  ratingScale: z.object({
    acidity: z.literal("1 = low acidity; 5 = high acidity"),
    body: z.literal("1 = light body; 5 = full body"),
  }),
  coffees: z.array(coffee).max(5),
  source: z.literal("BrewMark"),
  sourceUrl: z.literal("https://brewmark.io"),
});

const backendCommand = z.object({
  pathname: z.literal("/api/coffees"),
  searchParams: z.object({
    q: z.string().min(2).max(80),
    roastLevel: brewmarkRoast.optional(),
    sort: z.literal("alpha"),
    limit: z.literal("5"),
  }),
});
const backendCoffee = z.object({
  name: z.string().max(200),
  roasterName: z.string().max(200),
  roastLevel: brewmarkRoast,
  origin: z.string().max(200).nullable(),
  processingMethod: z.string().max(100).nullable(),
  flavorProfile: z.string().max(500).nullable(),
  acidityLevel: z.number().int().min(1).max(5).nullable(),
  bodyLevel: z.number().int().min(1).max(5).nullable(),
});
const backendPayload = z.object({
  data: z.array(backendCoffee).max(5),
  cursor: z.string().max(2_048).nullable(),
  hasMore: z.boolean(),
});
const backendResult = z.object({
  request: backendCommand,
  payload: backendPayload,
});

export function createBackendExample(client: JsonHttpClient): ReturnType<typeof createEmseepea> {
  const searchCoffeeCatalog = defineMappedTool({
    name: "search-coffee-catalog",
    access: "public",
    description: "Search BrewMark's public coffee catalogue and explain its acidity and body ratings.",
    inputSchema: searchInput,
    outputSchema: searchReport,
    backendInputSchema: backendCommand,
    backendOutputSchema: backendResult,
    mapInput: ({ query, roast }) => ({
      pathname: "/api/coffees" as const,
      searchParams: {
        q: query,
        ...(roast ? { roastLevel: publicToBrewmarkRoast[roast] } : {}),
        sort: "alpha" as const,
        limit: "5" as const,
      },
    }),
    async adapter(request, { signal, deadlineMs }) {
      return {
        request,
        payload: await client.get({ ...request, signal, deadlineMs }),
      };
    },
    mapOutput: ({ request, payload }) => {
      const coffees = payload.data.map((record) => ({
        name: record.name,
        roaster: record.roasterName,
        origin: record.origin,
        roast: brewmarkToPublicRoast[record.roastLevel],
        processingMethod: record.processingMethod,
        flavourNotes: record.flavorProfile,
        acidityLevel: record.acidityLevel,
        bodyLevel: record.bodyLevel,
      }));
      const roastFilter = request.searchParams.roastLevel
        ? brewmarkToPublicRoast[request.searchParams.roastLevel]
        : null;
      const data = {
        query: request.searchParams.q,
        roastFilter,
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
        `${record.name} by ${record.roaster}`,
        `origin: ${record.origin ?? "not provided"}`,
        `roast: ${record.roast}`,
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
  });

  return createEmseepea({
    name: "emseepea-backend-no-ui",
    version: "0.0.0",
    instructions: "Use search-coffee-catalog to search BrewMark's public coffee catalogue.",
    tools: [searchCoffeeCatalog],
  });
}
