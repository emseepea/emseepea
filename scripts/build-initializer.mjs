import assert from "node:assert/strict";
import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { initializerPackages } from "./public-packages.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageDirectory = resolve(process.cwd());
const packagePath = relative(root, packageDirectory).split(sep).join("/");
const matches = initializerPackages.filter(({ path }) => path === packagePath);
assert.equal(matches.length, 1, `Expected one initializer for ${packagePath}, found ${matches.length}`);
const [initializer] = matches;

const output = join(packageDirectory, "dist");
const template = join(output, "template");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("./initializer-runtime.mjs", import.meta.url), join(output, "create.mjs"));
await cp(join(root, "LICENSE"), join(output, "LICENSE"));
await chmod(join(output, "create.mjs"), 0o755);
await cp(join(root, "examples", initializer.example), template, {
  recursive: true,
  filter: (source) => !source.split(sep).some((part) => (
    ["artifacts", "dist", "node_modules"].includes(part) || / 2\.[^/]+$/.test(part)
  )),
});

const manifestPath = join(template, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.name = "emseepea-starter";
manifest.version = "0.0.0";
manifest.private = true;
delete manifest.workspaces;
for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
  if (!manifest[section]) continue;
  for (const [name, version] of Object.entries(manifest[section])) {
    if (name.startsWith("@emseepea/example-")) delete manifest[section][name];
    else assert.doesNotMatch(version, /^(?:file:|workspace:|\.\.?[\\/])/, `${name} is not standalone`);
  }
}

if (["native-ui", "react-tailwind-ui"].includes(initializer.example)) {
  await addUiSupport(initializer.example, template, manifest);
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

async function addUiSupport(example, destination, generatedManifest) {
  const sourceExtension = example === "react-tailwind-ui" ? "tsx" : "ts";
  await mkdir(join(destination, "test-support"), { recursive: true });
  await cp(join(root, "examples/ui-shared/src/index.ts"), join(destination, `src/ui-shared.${sourceExtension}`));
  await cp(
    join(root, "examples/ui-shared/test/browser-contract.mjs"),
    join(destination, "test-support/browser-contract.mjs"),
  );
  await cp(
    join(root, "examples/ui-shared/test/fixtures.test.mjs"),
    join(destination, "test/ui-shared.test.mjs"),
  );
  await replace(join(destination, `src/server.${sourceExtension}`), "@emseepea/example-ui-shared", "./ui-shared.js");
  await replace(
    join(destination, "src/capabilities/tool.preview-bean-report.ts"),
    "@emseepea/example-ui-shared",
    "../ui-shared.js",
  );
  await replace(
    join(destination, "test/accessibility.test.mjs"),
    "@emseepea/example-ui-shared/testing",
    "../test-support/browser-contract.mjs",
  );
  await replace(
    join(destination, "test-support/browser-contract.mjs"),
    "@emseepea/example-ui-shared",
    "../dist/ui-shared.js",
  );
  await replace(join(destination, "test/ui-shared.test.mjs"), "../dist/index.js", "../dist/ui-shared.js");
  generatedManifest.scripts.lint = `${generatedManifest.scripts.lint} test-support`;
}

async function replace(path, from, to) {
  const source = await readFile(path, "utf8");
  assert.ok(source.includes(from), `${relative(root, path)} does not contain ${from}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, source.replaceAll(from, to));
}
