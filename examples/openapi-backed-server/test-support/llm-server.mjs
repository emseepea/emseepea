import assert from "node:assert/strict";
import { serveEmseepea } from "@emseepea/server";
import { defineFeedbackSubmission } from "@emseepea/feedback";
import { createBackendExample } from "../dist/app.js";
import { petstoreFixture } from "./petstore-fixture.mjs";

const client = {
  async get({ pathname }) {
    assert.equal(pathname, "/api/v3/pet/7");
    return petstoreFixture;
  },
};
const feedback = defineFeedbackSubmission({
  access: "public",
  backend: { submit: () => ({ id: crypto.randomUUID(), recordedAt: new Date().toISOString() }) },
});
const app = await createBackendExample(client, { additionalTools: [feedback] });
const running = await serveEmseepea(app, { port: 0 });

console.log(`Em See Pea OpenAPI-backed fixture listening at ${running.url}`);

async function shutdown() {
  await running.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
