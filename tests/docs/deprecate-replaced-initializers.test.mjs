import assert from "node:assert/strict";
import test from "node:test";

import { deprecateReplacedInitializers } from "../../scripts/deprecate-replaced-initializers.mjs";

const message = "Deprecated: use @emseepea/create-multi-instance-postgres-server instead.";

test("deprecates replaced initializers only after replacement publication and verifies every version", async () => {
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

  await deprecateReplacedInitializers({ run, pause: async () => {} });

  assert.deepEqual(calls.find(([, first]) => first === "deprecate"), [
    "npm", "deprecate", "@emseepea/create-multi-instance-sqlite-server@*", message,
  ]);
  assert.equal(calls.filter(([, first]) => first === "view").length, 6);
});

test("does not mutate npm when the replacement is not published", async () => {
  const calls = [];
  await assert.rejects(
    () => deprecateReplacedInitializers({
      run: async (command, args) => { calls.push([command, ...args]); return "null"; },
    }),
    /must be published/,
  );
  assert.equal(calls.some(([, first]) => first === "deprecate"), false);
});
