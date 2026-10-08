import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { freezeUnplannedInitializers } from "../../scripts/freeze-unplanned-initializers.mjs";

const initializer = { name: "@emseepea/create-tool-server", path: "examples/tool-server" };
const feedback = { name: "@emseepea/feedback", path: "packages/feedback" };

async function fixture(t, currentInitializer) {
  const root = await mkdtemp(join(tmpdir(), "emseepea-release-freeze-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, initializer.path), { recursive: true });
  await mkdir(join(root, feedback.path), { recursive: true });
  const baseInitializer = {
    name: initializer.name,
    version: "0.1.0",
    starterDependencies: ["@emseepea/server"],
    devDependencies: { "@emseepea/server": "0.19.0", "@emseepea/feedback": "0.4.0" },
  };
  const baseFeedback = { name: feedback.name, version: "0.4.0" };
  const initializerPath = join(root, initializer.path, "package.json");
  await writeFile(initializerPath, JSON.stringify(currentInitializer ?? {
    ...baseInitializer,
    devDependencies: { ...baseInitializer.devDependencies, "@emseepea/feedback": "0.5.0" },
  }, null, 2) + "\n");
  await writeFile(join(root, feedback.path, "package.json"), JSON.stringify({ ...baseFeedback, version: "0.5.0" }) + "\n");
  const bases = new Map([
    [`${initializer.path}/package.json`, JSON.stringify(baseInitializer, null, 2) + "\n"],
    [`${feedback.path}/package.json`, JSON.stringify(baseFeedback) + "\n"],
  ]);
  return {
    root,
    initializerPath,
    baseInitializer,
    bases,
    run: (options = {}) => freezeUnplannedInitializers({
      root, initializers: [initializer], packages: [feedback],
      readBase: async (path) => bases.get(path),
      ...options,
    }),
  };
}

test("versioning keeps an unplanned initializer's generated starter dependency pinned", async (t) => {
  const { run, initializerPath, bases } = await fixture(t);
  await run();
  assert.equal(await readFile(initializerPath, "utf8"), bases.get(`${initializer.path}/package.json`));
});

test("versioning rejects unplanned starter and unrelated dependency changes", async (t) => {
  const first = await fixture(t);
  await writeFile(first.initializerPath, JSON.stringify({
    ...first.baseInitializer,
    devDependencies: { ...first.baseInitializer.devDependencies, "@emseepea/server": "0.20.0" },
  }) + "\n");
  await assert.rejects(first.run(), /starter dependency/i);

  const second = await fixture(t);
  await writeFile(second.initializerPath, JSON.stringify({
    ...second.baseInitializer,
    devDependencies: { ...second.baseInitializer.devDependencies, unrelated: "2.0.0" },
  }) + "\n");
  await assert.rejects(second.run(), /unexpected|unplanned/i);
});

test("versioning leaves planned initializer releases intact", async (t) => {
  const base = {
    name: initializer.name,
    version: "0.1.1",
    starterDependencies: ["@emseepea/server"],
    devDependencies: { "@emseepea/server": "0.19.0", "@emseepea/feedback": "0.5.0" },
  };
  const { run, initializerPath } = await fixture(t, base);
  await run();
  assert.deepEqual(JSON.parse(await readFile(initializerPath, "utf8")), base);
});

test("staged-candidate recovery restores a stale public dependency pin from the exact source", async (t) => {
  const { run, initializerPath, baseInitializer } = await fixture(t, {
    name: initializer.name,
    version: "0.1.0",
    starterDependencies: ["@emseepea/server"],
    devDependencies: { "@emseepea/server": "0.19.0", "@emseepea/feedback": "0.5.3" },
  });

  await assert.rejects(run(), /unexpected dependency change/i);
  await run({ restoreFromSource: true, sourceRef: "a".repeat(40) });
  assert.deepEqual(JSON.parse(await readFile(initializerPath, "utf8")), baseInitializer);
});

test("staged-candidate recovery requires an exact source and rejects unrelated changes", async (t) => {
  const first = await fixture(t);
  await assert.rejects(
    first.run({ restoreFromSource: true, sourceRef: "HEAD" }),
    /exact source commit/i,
  );

  const second = await fixture(t);
  await writeFile(second.initializerPath, JSON.stringify({
    ...second.baseInitializer,
    devDependencies: { ...second.baseInitializer.devDependencies, unrelated: "2.0.0" },
  }) + "\n");
  await assert.rejects(
    second.run({ restoreFromSource: true, sourceRef: "b".repeat(40) }),
    /unexpected|unplanned/i,
  );

  const third = await fixture(t);
  await writeFile(third.initializerPath, JSON.stringify({
    ...third.baseInitializer,
    devDependencies: { ...third.baseInitializer.devDependencies, "@emseepea/server": "0.20.0" },
  }) + "\n");
  await assert.rejects(
    third.run({ restoreFromSource: true, sourceRef: "c".repeat(40) }),
    /starter dependency/i,
  );

  const fourth = await fixture(t);
  await writeFile(fourth.initializerPath, JSON.stringify({
    ...fourth.baseInitializer,
    description: "unexpected",
  }) + "\n");
  await assert.rejects(
    fourth.run({ restoreFromSource: true, sourceRef: "d".repeat(40) }),
    /unexpected change/i,
  );
});
