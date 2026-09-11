import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

async function manifest(name) {
  const root = path.dirname(path.dirname(require.resolve(name)));
  return JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
}

const typedOpenapiRoot = path.dirname(path.dirname(require.resolve("typed-openapi")));
const typedOpenapiLicense = await readFile(path.join(typedOpenapiRoot, "LICENSE"));
assert.equal((await manifest("typed-openapi")).version, "4.0.1");
assert.equal(
  createHash("sha256").update(typedOpenapiLicense).digest("hex"),
  "ec37c1598e498ddfad278fc180baaf2fd2545d39754075cd0a76dbe85198c90c",
  "typed-openapi's shipped MIT licence changed",
);
assert.deepEqual(
  [await manifest("@scalar/openapi-upgrader"), await manifest("yaml")]
    .map(({ name, version, license }) => ({ name, version, license })),
  [
    { name: "@scalar/openapi-upgrader", version: "0.2.15", license: "MIT" },
    { name: "yaml", version: "2.9.0", license: "ISC" },
  ],
);
