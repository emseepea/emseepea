import { fileURLToPath } from "node:url";
import { createEmseepea, discoverCapabilities } from "@emseepea/server";
import { createClientAsync } from "soap";
import { z } from "zod";
import { loadSoapEnvelopeSchema } from "./soap-schema.js";
import { ValidatingHttpClient } from "./validating-http-client.js";

export async function createSoapExample(endpointValue: string) {
  const endpoint = new URL(z.string().url().parse(endpointValue));
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error("SOAP endpoint must be an HTTP address without credentials or a fragment");
  }
  const schema = await loadSoapEnvelopeSchema();
  const client = await createClientAsync(
    fileURLToPath(new URL("../contracts/pea-service.wsdl", import.meta.url)),
    { disableCache: true, httpClient: new ValidatingHttpClient(endpoint, schema), strict: true },
    endpoint.href,
  );
  const app = createEmseepea({
    name: "emseepea-soap-backed-server",
    version: "0.0.0",
    instructions: "Retrieve pea variety details from a legacy SOAP service.",
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), { client }),
  });
  return { app };
}
