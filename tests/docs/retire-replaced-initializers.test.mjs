import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { retireReplacedInitializers } from "../../scripts/retire-replaced-initializers.mjs";

const message = "Deprecated: use @emseepea/create-multi-instance-postgres-server instead.";

test("the package retirement command names an existing script", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const [, script] = manifest.scripts["release:deprecate-replaced"].split(" ");

  await access(new URL(`../../${script}`, import.meta.url));
});

test("accepts a replaced initializer that has already been removed", async () => {
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined.includes("create-multi-instance-postgres-server version")) return '["0.0.1"]';
    if (joined.includes("create-multi-instance-sqlite-server versions")) throw new Error("E404");
    throw new Error(`Unexpected command: ${command} ${joined}`);
  };

  await retireReplacedInitializers({ run, pause: async () => {} });

  assert.equal(calls.some(([, first]) => first === "unpublish"), false);
  assert.equal(calls.some(([, first]) => first === "deprecate"), false);
});

test("deprecates every published version", async () => {
  const calls = [];
  let deprecated = false;
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (joined.includes("create-multi-instance-postgres-server version")) return '"0.0.1"';
    if (joined.includes("create-multi-instance-sqlite-server versions")) return '["0.0.10","0.0.11"]';
    if (args[0] === "deprecate") { deprecated = true; return ""; }
    if (joined.includes(" deprecated ")) return deprecated ? JSON.stringify(message) : "";
    throw new Error(`Unexpected command: ${command} ${joined}`);
  };

  await retireReplacedInitializers({ run, pause: async () => {} });

  assert.deepEqual(calls.find(([, first]) => first === "deprecate"), [
    "npm", "deprecate", "@emseepea/create-multi-instance-sqlite-server@*", message,
  ]);
  assert.equal(calls.filter(([, first]) => first === "view").length, 6);
});

test("does not mistake registry failures for package removal", async () => {
  await assert.rejects(() => retireReplacedInitializers({
    run: async (_command, args) => {
      if (args.join(" ").includes("create-multi-instance-postgres-server version")) return '"0.0.1"';
      throw new Error("registry timed out");
    },
  }), /registry timed out/);
});

test("does not mutate npm when the replacement is not published", async () => {
  for (const response of ["null", "[]", '[""]', '["0.0.1",null]']) {
    const calls = [];
    await assert.rejects(
      () => retireReplacedInitializers({
        run: async (command, args) => { calls.push([command, ...args]); return response; },
      }),
      /must be published/,
    );
    assert.equal(calls.some(([, first]) => first === "deprecate"), false);
  }
});
