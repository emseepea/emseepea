import assert from "node:assert/strict";
import { serveEmseepea } from "@emseepea/server";
import { createBackendExample } from "../dist/app.js";
import { brewmarkFixture } from "./brewmark-fixture.mjs";

const app = createBackendExample({
  async get({ pathname, searchParams }) {
    assert.equal(pathname, "/api/coffees");
    const { q, ...options } = searchParams;
    assert.match(q, /\bnatural\b/i);
    assert.deepEqual(options, { sort: "alpha", limit: "5" });
    return brewmarkFixture;
  },
});
const running = await serveEmseepea(app, { port: 0 });

console.log(`Em See Pea backend no-UI fixture listening at ${running.url}`);

async function shutdown() {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
