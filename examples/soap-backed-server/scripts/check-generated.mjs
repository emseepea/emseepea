import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generatedArtifacts } from "./generate-types.mjs";

const generated = await generatedArtifacts();
assert.equal(
  await readFile(new URL("../src/generated/pea-service.ts", import.meta.url), "utf8"),
  generated.types,
  "generated SOAP types are stale",
);
assert.equal(
  await readFile(new URL("../src/generated/pea-service.schema-model.json", import.meta.url), "utf8"),
  generated.model,
  "generated SOAP schema model is stale",
);
