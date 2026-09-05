import assert from "node:assert/strict";
import { chmod, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { initializerPackages } from "./public-packages.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageDirectory = resolve(process.cwd());
const packagePath = relative(root, packageDirectory).split(sep).join("/");
const matches = initializerPackages.filter(({ path }) => path === packagePath);
assert.equal(matches.length, 1, `Expected one initializer for ${packagePath}, found ${matches.length}`);
const [initializer] = matches;

const output = join(packageDirectory, "initializer-dist");
const template = join(output, "template");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("./initializer-runtime.mjs", import.meta.url), join(output, "create.mjs"));
await cp(join(root, "LICENSE"), join(output, "LICENSE"));
await chmod(join(output, "create.mjs"), 0o755);
await mkdir(template, { recursive: true });
for (const entry of await readdir(packageDirectory)) {
  if (["CHANGELOG.md", "artifacts", "dist", "initializer-dist", "node_modules"].includes(entry) || / 2\.[^/]+$/.test(entry)) continue;
  await cp(join(packageDirectory, entry), join(template, entry), { recursive: true });
}

const manifestPath = join(template, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const readmePath = join(template, "README.md");
const readme = await readFile(readmePath, "utf8");
const readmeMarker = "<!-- generated-project-readme -->";
assert.ok(readme.includes(readmeMarker), `${initializer.path}/README.md is missing ${readmeMarker}`);
const generatedReadme = readme.split(readmeMarker)[1].trim();
assert.ok(generatedReadme.startsWith("## "), `${initializer.path}/README.md needs a project heading after the marker`);
await writeFile(readmePath, `#${generatedReadme.slice(2)}\n`);
manifest.name = "emseepea-starter";
manifest.version = "0.0.0";
manifest.private = true;
delete manifest.bin;
delete manifest.bugs;
delete manifest.files;
delete manifest.homepage;
delete manifest.publishConfig;
delete manifest.repository;
delete manifest.workspaces;
manifest.scripts.build = manifest.scripts["build:example"];
delete manifest.scripts["build:example"];
delete manifest.scripts["build:initializer"];
delete manifest.scripts.prepack;
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
