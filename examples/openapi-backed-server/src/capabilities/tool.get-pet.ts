import { defineMappedTool, type AccessPolicy, type CapabilityModuleFactory } from "@emseepea/server";
import type { JsonHttpClient } from "@emseepea/server/http";
import { z } from "zod";
import { get_GetPetById } from "../generated/petstore.js";

export interface BackendExampleContext {
  readonly client: JsonHttpClient;
  readonly access: AccessPolicy;
}

const inputSchema = z.object({
  petId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
    .describe("Positive Swagger Petstore identifier to look up."),
});
const outputSchema = z.object({
  id: z.number().int().positive().describe("Identifier returned for the pet."),
  name: z.string().min(1).max(200).describe("Name of the pet."),
  status: z.enum(["available", "pending", "sold"]).optional()
    .describe("Current Petstore availability when supplied."),
  photoUrls: z.array(z.string().url().max(2_048)).max(10)
    .describe("Up to ten photo URLs supplied by Petstore."),
  source: z.literal("Swagger Petstore").describe("Data provider for this result."),
});
const backendInputSchema = z.object({
  pathname: z.string().regex(/^\/api\/v3\/pet\/[1-9]\d*$/),
  parameters: get_GetPetById.parameters.path,
});
const backendOutputSchema = z.object({
  request: backendInputSchema,
  payload: get_GetPetById.responses[200],
});

export default (({ client, access }) => defineMappedTool({
  name: "get-pet",
  ...access,
  description: "Look up one pet by identifier in Swagger Petstore.",
  inputSchema,
  outputSchema,
  backendInputSchema,
  backendOutputSchema,
  mapInput: ({ petId }) => ({
    pathname: `/api/v3/pet/${petId}`,
    parameters: { petId },
  }),
  async adapter(request, { signal, deadlineMs }) {
    return {
      request,
      payload: await client.get({ pathname: request.pathname, signal, deadlineMs }),
    };
  },
  mapOutput: ({ request, payload }) => ({
    data: {
      id: payload.id ?? request.parameters.petId,
      name: payload.name,
      status: payload.status,
      photoUrls: payload.photoUrls,
      source: "Swagger Petstore" as const,
    },
  }),
})) satisfies CapabilityModuleFactory<BackendExampleContext>;
