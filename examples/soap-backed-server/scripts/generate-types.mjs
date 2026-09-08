import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generateTypeScript, parseXsdAsync } from "xml-xsd-engine";

const envelope = new URL("../contracts/soap-envelope.xsd", import.meta.url);
const service = new URL("../contracts/pea-service.xsd", import.meta.url);

export async function generatedArtifacts() {
  const serviceSource = await readFile(service, "utf8");
  return artifactsFromSources(await readFile(envelope, "utf8"), serviceSource);
}

export async function artifactsFromSources(envelopeSource, serviceSource) {
  const schema = await parseXsdAsync(envelopeSource, async (location, namespace) => {
    if (location !== "pea-service.xsd" || namespace !== "urn:emseepea:pea-service") {
      throw new Error("Blocked schema import");
    }
    return serviceSource;
  });
  const types = generateTypeScript(schema, {
    exportAll: true,
    header: "// Generated from the local SOAP XSD graph. Do not edit.",
    typeMap: {
      "{http://schemas.xmlsoap.org/soap/envelope/}SoapBody": "SoapBody",
      "{http://schemas.xmlsoap.org/soap/envelope/}SoapEnvelope": "SoapEnvelope",
      "{urn:emseepea:pea-service}PeaType": "PeaType",
      "{urn:emseepea:pea-service}PeaVariety": "PeaVariety",
    },
  });
  return {
    model: `${JSON.stringify(schema.toJSON(), null, 2)}\n`,
    types: `${types.trim()}\n`,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const generated = await generatedArtifacts();
  await Promise.all([
    writeFile(new URL("../src/generated/pea-service.ts", import.meta.url), generated.types),
    writeFile(new URL("../src/generated/pea-service.schema-model.json", import.meta.url), generated.model),
  ]);
}
