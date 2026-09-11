export namespace Schemas {
    // <Schemas>
  export type Category = Partial<{ id: number, name: string }>
export type Tag = Partial<{ id: number, name: string }>
export type Pet = ({
  id?: number;
  name: string;
  category?: Category;
  photoUrls: Array<string>;
  tags?: Array<Tag>;
  /**
   * pet status in the store
   */
  status?: ("available" | "pending" | "sold");
} & Record<string, unknown>)

    // </Schemas>
    }

  export namespace Endpoints {
  // <Endpoints>

  /**
 * Returns a single pet.
 */
export type get_GetPetById = {
      method: "GET",
      path: "/pet/{petId}",
      requestFormat: "json",
      responseFormat: "json",
      parameters: {

        path:  { petId: number },



          }
      responses: {200: Schemas.Pet,
400: unknown,
404: unknown,
default: unknown,
},

    }

  // </Endpoints>
  }


     // <EndpointByMethod>
     export type EndpointByMethod = {
     get: {
           "/pet/{petId}": Endpoints.get_GetPetById
         }
     }

     // </EndpointByMethod>


    // <EndpointByMethod.Shorthands>
    export type GetEndpoints = EndpointByMethod["get"]
    // </EndpointByMethod.Shorthands>
