import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createEmseepea } from "@emseepea/server";
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";
import { defineFeedbackSubmission } from "../dist/index.js";

const recordedAt = "2026-10-23T00:00:00.000Z";
const description = "Record one actionable observation about the calculator operation being performed. " +
  "A qualifying observation may come from the user's message or a calculator tool result; exclude unrelated conversation and general behavior. " +
  "Call before answering without a separate permission question; after success answer the original request and disclose the observation. " +
  "Skip routine successes, expected empty results and duplicates; stop after objections. " +
  "Exclude identity, personal or financial details, credentials, conversation and raw inputs or results. " +
  "No conversation or identity is automatically attached. The operator retains feedback indefinitely in Firestore; instructions cannot guarantee private information is absent.";
const versions = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"];

for (const access of ["public", "protected"]) {
  test(`${access} description customization changes only discovery wording across supported protocols`, async (t) => {
    const persisted = [];
    const pending = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const options = {
      access,
      ...(access === "protected" ? { requiredScopes: ["feedback"] } : {}),
      scope: "calculator",
      annotations: { openWorldHint: false },
      backend: { async submit(command, context) {
        entered.resolve();
        if (command.detail === "wait for persistence") await pending.promise;
        if (command.detail === "storage failed") throw new Error("private backend failure");
        persisted.push({ command, scope: context.scope });
        return { id: "record-1", recordedAt };
      } },
    };
    const run = async (custom) => startEmseepea(t, createEmseepea({
      name: "description-test", version: "0.0.0",
      authentication: insecureTestAuthentication(["feedback"]),
      tools: [defineFeedbackSubmission({ ...options, ...(custom ? { description } : {}) })],
    }));
    const baseline = await run(false);
    const customized = await run(true);
    for (const version of versions) {
      const clients = [];
      try {
        for (const running of [baseline, customized]) {
          const client = new Client({ name: "description-test", version: "0.0.0" }, {
            supportedProtocolVersions: [version],
            versionNegotiation: version === "2026-07-28" ? { mode: { pin: version } } : { mode: "legacy" },
          });
          clients.push(client);
          await client.connect(new StreamableHTTPClientTransport(running.url, {
            requestInit: { headers: { Authorization: "Bearer test-token" } },
          }));
        }
        const [original, custom] = await Promise.all(clients.map(async (client) => (await client.listTools()).tools[0]));
        assert.equal(custom.description, description);
        assert.deepEqual({ ...custom, description: original.description }, original);
        assert.match(original.description, /application operation being performed/);
        assert.match(original.description, /do not collect unrelated conversation or general user behavior/);
        assert.match(original.description, /without asking a separate permission question/);
        assert.match(original.description, /fully answer the original request/);
        assert.match(original.description, /disclose the specific observation recorded in the same reply/);
        assert.match(original.description, /Do not claim feedback was recorded if submission failed/);
        assert.match(original.description, /Skip routine successes, expected empty results, session opening or closing and duplicates/);
        assert.match(original.description, /Do not record after the user objects/);
        assert.match(original.description, /Exclude identity, personal or financial details, credentials, surrounding conversation and raw application inputs or results/);
        assert.match(original.description, /No conversation or identity context is automatically attached/);
        assert.match(original.description, /model instructions do not guarantee/);
        assert.equal(persisted.length, 0);
      } finally {
        await Promise.all(clients.map((client) => client.close()));
      }
    }
    const client = await customized.connect("test-token");
    const invalid = await client.callTool({ name: "submit-feedback", arguments: { observation: "suggestion", detail: "" } });
    assert.equal(invalid.isError, true);
    assert.equal(persisted.length, 0);
    let completed = false;
    const receipt = client.callTool({ name: "submit-feedback", arguments: { observation: "suggestion", detail: "wait for persistence" } })
      .then((result) => { completed = true; return result; });
    await entered.promise;
    assert.equal(completed, false);
    assert.equal(persisted.length, 0);
    pending.resolve();
    const result = await receipt;
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.id, "record-1");
    assert.equal(result.structuredContent.recordedAt, recordedAt);
    assert.match(result.structuredContent.nextAction, /answering every part/);
    assert.deepEqual(persisted, [{ command: { observation: "suggestion", detail: "wait for persistence", context: undefined }, scope: "calculator" }]);
    const failed = await client.callTool({ name: "submit-feedback", arguments: { observation: "error", detail: "storage failed" } });
    assert.equal(failed.isError, true);
    assert.equal(failed.structuredContent, undefined);
    assert.doesNotMatch(JSON.stringify(failed), /private backend failure|record-1|recordedAt/);
    assert.equal(persisted.length, 1);
  });
}

test("description configuration rejects blank and non-string values before backend work", () => {
  let calls = 0;
  for (const description of ["", " \n\t", null, 12, {}]) {
    assert.throws(() => defineFeedbackSubmission({ access: "public", description,
      backend: { submit() { calls++; return { id: "unused", recordedAt }; } },
    }));
  }
  assert.equal(calls, 0);
});
