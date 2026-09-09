import { fileURLToPath } from "node:url";
import {
  createEmseepea,
  discoverCapabilities,
  type AccessPolicy,
  type EmseepeaExtensions,
} from "@emseepea/server";
import { createClientAsync } from "soap";
import { z } from "zod";
import { loadSoapEnvelopeSchema } from "./soap-schema.js";
import { ValidatingHttpClient } from "./validating-http-client.js";

export interface SoapExampleOptions extends EmseepeaExtensions {
  readonly access?: AccessPolicy;
}

export async function createSoapExample(endpointValue: string, options: SoapExampleOptions = {}) {
  const { access = { access: "public" }, ...extensions } = options;
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
    ...await discoverCapabilities(new URL("./capabilities/", import.meta.url), { client, access }),
    ...extensions,
  });
  return { app };
}
