import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { discoverTests } from "../../packages/testing/semantic/discover.mjs";
import { fileURLToPath } from "node:url";
import { initializerPackages } from "../../scripts/public-packages.mjs";

const examplesRoot = new URL("../../examples/", import.meta.url);
const testingManifest = JSON.parse(await readFile(new URL("../../packages/testing/package.json", import.meta.url), "utf8"));
const builderImage = "docker.io/library/node:24.21.0-trixie-slim@sha256:db3ae80f5d8df06e04dabdf7b44cbf008d32de168205fa0294444aabbc08c590";
const runtimeImage = "gcr.io/distroless/nodejs24-debian13:nonroot@sha256:7781e8b4fccf59240bd539af6738cccf8dad4be303165c3a1fa065c48699b937";

test("every runnable example visibly owns deterministic and LLM checks", async () => {
  const directories = await readdir(examplesRoot, { withFileTypes: true });
  for (const directory of directories.filter((entry) => entry.isDirectory())) {
    const manifestUrl = new URL(`${directory.name}/package.json`, examplesRoot);
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    assert.ok(manifest.scripts?.test, `${directory.name} has no test command`);
    assert.ok(manifest.scripts?.["test:built"], `${directory.name} has no root-CI test command`);
    assert.doesNotMatch(manifest.scripts["test:built"], /\beval\b/, `${directory.name} ordinary tests must not run LLM tests`);
    assert.ok(manifest.scripts?.lint, `${directory.name} has no lint command`);
    assert.doesNotMatch(manifest.scripts.test, /\.\.\/\.\.|--prefix|-w\s/, `${directory.name} test depends on the monorepo`);
    assert.doesNotMatch(manifest.scripts.lint, /\.\.\/\.\.|--prefix|-w\s/, `${directory.name} lint depends on the monorepo`);
    assert.equal(manifest.devDependencies?.oxlint, "1.80.0");
    await access(new URL(`${directory.name}/test`, examplesRoot));

    if (!manifest.scripts.start) continue;
    assert.equal(manifest.devDependencies?.typescript, "6.0.3");
    assert.equal(manifest.devDependencies?.["@types/node"], "24.13.3");
    const tsconfig = await readFile(new URL(`${directory.name}/tsconfig.json`, examplesRoot), "utf8");
    assert.doesNotMatch(tsconfig, /\.\.\/\.\./, `${directory.name} TypeScript config depends on the monorepo`);
    assert.ok(manifest.scripts["test:llm"], `${directory.name} has no LLM test command`);
    assert.equal(manifest.devDependencies?.["@emseepea/testing"], testingManifest.version);
    assert.doesNotMatch(manifest.scripts["test:llm"], /\.\.\/\.\.|--prefix|-w\s/, `${directory.name} LLM test depends on the monorepo`);
    const cases = await discoverTests([fileURLToPath(new URL(`${directory.name}/eval`, examplesRoot))]);
    assert.ok(cases.length > 0);
    assert.equal(
      manifest.scripts["test:llm:built"],
      directory.name.includes("postgres") || directory.name === "database-schema-server"
        ? "node test/with-postgres.mjs emseepea-test eval"
        : directory.name === "mongodb-backed-server"
          ? "node test/with-mongodb.mjs emseepea-test eval"
          : "emseepea-test eval",
    );
    assert.match(manifest.scripts.lint, /\beval\b/);
    assert.ok(!(await readdir(new URL(directory.name + "/", examplesRoot))).some((name) => /eval.*\.ya?ml$/.test(name)));
  }
});

test("every initializer owns the same safe container contract", async () => {
  const expectedIgnored = [
    ".env", ".env.*", ".git", ".github", ".npmrc", "artifacts", "dist",
    "initializer-dist", "node_modules", "release-artifacts", "*.log",
  ];
  for (const initializer of initializerPackages) {
    const directory = new URL(`${initializer.example}/`, examplesRoot);
    const [manifest, dockerfile, dockerignore, readme, server] = await Promise.all([
      readFile(new URL("package.json", directory), "utf8").then(JSON.parse),
      readFile(new URL("Dockerfile", directory), "utf8"),
      readFile(new URL(".dockerignore", directory), "utf8"),
      readFile(new URL("README.md", directory), "utf8"),
      readFile(new URL(initializer.example === "react-ui-server" ? "src/server.tsx" : "src/server.ts", directory), "utf8"),
    ]);
    assert.equal(manifest.scripts["build:initializer"], "node ../../scripts/build-initializer.mjs");
    assert.equal(dockerfile.match(/^FROM /gm)?.length, 2, `${initializer.example} should use two container stages`);
    assert.ok(dockerfile.includes(`FROM ${builderImage} AS build`), `${initializer.example} builder image drifted`);
    assert.ok(dockerfile.includes(`FROM ${runtimeImage}`), `${initializer.example} runtime image drifted`);
    assert.ok(dockerfile.includes('test "$(node --version)" = "v24.21.0"'));
    assert.ok(dockerfile.includes("test -f package-lock.json"));
    assert.ok(dockerfile.includes("npm ci --ignore-scripts"));
    assert.doesNotMatch(dockerfile, /\\\\\n/, `${initializer.example} has a doubled Dockerfile continuation`);
    assert.ok(dockerfile.includes("npm prune --omit=dev --ignore-scripts"));
    assert.ok(dockerfile.includes("ENV EMSEEPEA_DEPLOYMENT_MODE=production-behind-proxy"));
    assert.doesNotMatch(dockerfile, /^ENV NODE_ENV=/m);
    assert.ok(dockerfile.includes("USER 65532:65532"));
    assert.ok(dockerfile.includes('CMD ["dist/server.js"]'));
    assert.ok(dockerfile.includes('"/nodejs/bin/node"'));
    assert.match(server, /loadDeploymentProfile\(\)/);
    for (const ignored of expectedIgnored) {
      assert.match(dockerignore, new RegExp(`^${ignored.replaceAll(".", "\\.").replaceAll("*", "\\*")}$`, "m"), `${initializer.example} does not ignore ${ignored}`);
    }
    if (initializer.example === "soap-backed-server") {
      assert.ok(dockerfile.includes("/app/contracts ./contracts"));
    }
    if (initializer.example === "multi-instance-postgres-server") {
      assert.doesNotMatch(dockerfile, /start-two/);
    }
    assert.match(readme, /\bnpm run container:build\b/);
    assert.doesNotMatch(readme, /\bdocker (?:build|run)\b/i);
    if (["database-schema-server", "mongodb-backed-server", "multi-instance-postgres-server"].includes(initializer.example)) {
      assert.equal(manifest.scripts["db:start"], "docker compose up --detach --wait database");
      assert.equal(manifest.scripts["db:reset"], "docker compose down --volumes");
      assert.match(manifest.scripts.dev, /^npm run db:start && /);
    }
  }
});

test("public routine docs use npm scripts for containers and local databases", async () => {
  const files = [
    new URL("../../README.md", import.meta.url),
    new URL("../../website/src/content/docs/examples.md", import.meta.url),
    new URL("../../website/src/content/docs/getting-started.md", import.meta.url),
    ...initializerPackages.map(({ example }) => new URL(`${example}/README.md`, examplesRoot)),
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\bdocker (?:build|run)\b/i, file.pathname);
    assert.doesNotMatch(source, /\bdocker compose (?:up|down)\b/i, file.pathname);
  }
  const website = await readFile(new URL("../../website/src/content/docs/examples.md", import.meta.url), "utf8");
  const gettingStarted = await readFile(new URL("../../website/src/content/docs/getting-started.md", import.meta.url), "utf8");
  const rootReadme = await readFile(new URL("../../README.md", import.meta.url), "utf8");
  assert.match(website, /^## Build a production container$/m);
  assert.match(gettingStarted, /\.\.\/examples\/#build-a-production-container/);
  assert.match(rootReadme, /website\/src\/content\/docs\/examples\.md#build-a-production-container/);
});
