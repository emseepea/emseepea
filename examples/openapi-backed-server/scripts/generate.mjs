import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upgradeFromTwoToThree } from "@scalar/openapi-upgrader/2.0-to-3.0";
import { generateClientFiles } from "typed-openapi/node";
import { parse } from "yaml";

const contract = new URL("../contracts/petstore.openapi.json", import.meta.url);

export function assertLocalReferences(value, location = "$") {
  if (!value || typeof value !== "object") return;
  if ("$ref" in value) {
    assert.equal(typeof value.$ref, "string", `${location} has a non-string $ref`);
    assert.match(value.$ref, /^#\//, `${location} has a non-local $ref`);
  }
  for (const [key, child] of Object.entries(value)) {
    assertLocalReferences(child, `${location}.${key}`);
  }
}

export function parseContract(source) {
  const document = parse(source);
  assertLocalReferences(document);
  return document;
}

export function upgradeSwagger(source) {
  const upgraded = upgradeFromTwoToThree(parseContract(source));
  assertLocalReferences(upgraded);
  return upgraded;
}

export async function generatedArtifacts(document) {
  assertLocalReferences(document);
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-openapi-"));
  try {
    const input = path.join(directory, "petstore.json");
    const output = path.join(directory, "petstore.ts");
    await writeFile(input, `${JSON.stringify(document)}\n`);
    await generateClientFiles(input, {
      output,
      runtime: "zod",
      validation: "strict",
      includeClient: false,
      includeDescriptions: true,
      endpoint: "getPetById",
    });
    return {
      schemas: normalize(await readFile(output, "utf8")),
      types: normalize(await readFile(path.join(directory, "petstore.types.d.ts"), "utf8")),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function normalize(source) {
  return `${source.split("\n").map((line) => line.trimEnd()).join("\n").trim()}\n`;
}

export async function canonicalArtifacts() {
  return generatedArtifacts(parseContract(await readFile(contract, "utf8")));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const generated = await canonicalArtifacts();
  await mkdir(new URL("../src/generated/", import.meta.url), { recursive: true });
  await Promise.all([
    writeFile(new URL("../src/generated/petstore.ts", import.meta.url), generated.schemas),
    writeFile(new URL("../src/generated/petstore.types.d.ts", import.meta.url), generated.types),
  ]);
}
