// @ts-nocheck
import type * as __TypedOpenapi from "./petstore.types.js";

  import { z } from "zod";

// <Schemas>
export type Category = __TypedOpenapi.Schemas.Category;
export const Category = z.object({ id: z.number().int(), name: z.string() }).partial().catchall(z.unknown());

export type Tag = __TypedOpenapi.Schemas.Tag;
export const Tag = z.object({ id: z.number().int(), name: z.string() }).partial().catchall(z.unknown());

export type Pet = __TypedOpenapi.Schemas.Pet;
export const Pet = z.object({ id: z.number().int().optional(), name: z.string(), category: Category.optional(), photoUrls: z.array(z.string()), tags: z.array(Tag).optional(), status: z.enum(["available", "pending", "sold"]).describe("pet status in the store").optional() }).catchall(z.unknown());

// </Schemas>

// <Endpoints>
export type get_GetPetById = __TypedOpenapi.Endpoints.get_GetPetById;
export const get_GetPetById = {
  method: z.literal("GET"),
  path: z.literal("/pet/{petId}"),
  requestFormat: z.literal("json"),
  responseFormat: z.literal("json"),
  parameters: { path: z.object({ petId: z.coerce.number().int() }).strict() },
  responses: { 200: Pet, 400: z.unknown(), 404: z.unknown(), default: z.unknown() },
};

// </Endpoints>


     // <EndpointByMethod>
     export const EndpointByMethod = {
     get: {
           "/pet/{petId}": get_GetPetById
         }
     } satisfies { [M in keyof __TypedOpenapi.EndpointByMethod]: { [P in keyof __TypedOpenapi.EndpointByMethod[M]]: unknown } }
     export type EndpointByMethod = __TypedOpenapi.EndpointByMethod;
     // </EndpointByMethod>


    // <EndpointByMethod.Shorthands>
    export type GetEndpoints = EndpointByMethod["get"]
    // </EndpointByMethod.Shorthands>
