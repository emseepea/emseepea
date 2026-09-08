import { readFile } from "node:fs/promises";
import { parseXsd, parseXsdAsync, type SchemaModel } from "xml-xsd-engine";

const contractDirectory = new URL("../contracts/", import.meta.url);

export interface SoapSchemaGraph {
  readonly envelope: SchemaModel;
  readonly service: SchemaModel;
}

export async function loadSoapEnvelopeSchema(): Promise<SoapSchemaGraph> {
  const service = await readFile(new URL("pea-service.xsd", contractDirectory), "utf8");
  const envelope = await readFile(new URL("soap-envelope.xsd", contractDirectory), "utf8");
  return parseSoapEnvelopeSchema(envelope, service);
}

export async function parseSoapEnvelopeSchema(
  envelope: string,
  service: string,
): Promise<SoapSchemaGraph> {
  const resolvedEnvelope = await parseXsdAsync(envelope, async (location, namespace) => {
    if (location !== "pea-service.xsd" || namespace !== "urn:emseepea:pea-service") {
      throw new Error("Blocked schema import");
    }
    return service;
  });
  return { envelope: resolvedEnvelope, service: parseXsd(service) };
}
