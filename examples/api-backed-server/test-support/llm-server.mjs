import assert from "node:assert/strict";
import { serveEmseepea } from "@emseepea/server";
import { createBackendExample } from "../dist/app.js";
import { inaturalistFixture } from "./inaturalist-fixture.mjs";

const app = await createBackendExample({
  async get({ pathname, searchParams }) {
    assert.equal(pathname, "/v1/taxa");
    const { q, ...options } = searchParams;
    assert.match(q, /\bpea\b/i);
    assert.deepEqual(options, { rank: "species", per_page: "5" });
    return inaturalistFixture;
  },
});
const running = await serveEmseepea(app, { port: 0 });

console.log(`Em See Pea API-backed fixture listening at ${running.url}`);

async function shutdown() {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
