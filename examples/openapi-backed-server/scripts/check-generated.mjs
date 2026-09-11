import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalArtifacts, generatedArtifacts, upgradeSwagger } from "./generate.mjs";

const generated = await canonicalArtifacts();
assert.match(generated.schemas, /from "zod"/);
assert.match(generated.schemas, /get_GetPetById/);
assert.doesNotMatch(generated.schemas, /\bfetch\s*\(/);
assert.match(generated.types, /namespace Endpoints/);
assert.equal(
  await readFile(new URL("../src/generated/petstore.ts", import.meta.url), "utf8"),
  generated.schemas,
  "generated OpenAPI schemas are stale",
);
assert.equal(
  await readFile(new URL("../src/generated/petstore.types.d.ts", import.meta.url), "utf8"),
  generated.types,
  "generated OpenAPI declarations are stale",
);
const swagger = upgradeSwagger(await readFile(new URL("../test/fixtures/petstore.swagger.yaml", import.meta.url), "utf8"));
assert.equal(swagger.paths["/pet/{petId}"].get.operationId, "getPetById");
assert.match((await generatedArtifacts(swagger)).schemas, /get_GetPetById/);
