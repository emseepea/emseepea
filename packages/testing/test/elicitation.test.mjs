import assert from "node:assert/strict";
import test from "node:test";
import { scriptedElicitations } from "../semantic/elicitation.mjs";

const request = { subtype: "elicitation", mcp_server_name: "emseepea_eval", mode: "form",
  message: 'Create "Synthetic Customer" with email "reviewer@example.test"?',
  requested_schema: { type: "object", properties: { decision: { enum: ["create", "cancel"] } } },
  privateEnvelopeField: "provider-envelope-must-not-be-retained",
};
const entry = { messageIncludes: ["Synthetic Customer", "reviewer@example.test"],
  response: { action: "accept", content: { decision: "create" } } };

test("matches an actual request to explicit human input and retains only semantic evidence", () => {
  const script = scriptedElicitations({ elicitations: [entry] });
  assert.deepEqual(script.respond(request), entry.response);
  script.finish();
  assert.deepEqual(script.evidence, [{ mode: "form", message: request.message,
    requestedSchema: request.requested_schema, response: entry.response, inputSource: "scripted-human" }]);
  assert.ok(!JSON.stringify(script.evidence).includes(request.privateEnvelopeField));
});

test("unconfigured, ambiguous, mismatched and duplicate requests cannot be confirmed", () => {
  assert.throws(() => scriptedElicitations().respond(request), /Unexpected/);
  assert.throws(() => scriptedElicitations({ elicitations: [entry, entry] }).respond(request), /Unexpected/);
  const script = scriptedElicitations({ elicitations: [entry] });
  assert.throws(() => script.respond({ ...request, message: "Create Other Customer?" }), /Unexpected/);
  assert.equal(script.evidence[0].response, undefined);
  script.respond(request);
  assert.throws(() => script.respond(request), /duplicate/);
});

test("unused scripts, another server, URL requests and malformed scripts fail closed", () => {
  const script = scriptedElicitations({ elicitations: [entry] });
  assert.throws(() => script.finish(), /Unused/);
  for (const changed of [{ mode: "url" }, { mcp_server_name: "other-server" }, { requested_schema: null }]) {
    assert.throws(() => script.respond({ ...request, ...changed }), /Unsupported/);
  }
  for (const invalid of [{ messageIncludes: [], response: entry.response },
    { ...entry, response: { action: "approve-everything" } }]) {
    assert.throws(() => scriptedElicitations({ elicitations: [invalid] }), /Invalid/);
  }
});

test("cancel is supplied explicitly and fixture mutation cannot change the selected decision", () => {
  const cancel = { messageIncludes: entry.messageIncludes, response: { action: "cancel" } };
  const script = scriptedElicitations({ elicitations: [cancel] });
  cancel.response.action = "accept";
  assert.deepEqual(script.respond(request), { action: "cancel" });
  script.finish();
});

test("known credentials are scrubbed recursively from successful and rejected evidence, not transport input", () => {
  const secret = 'synthetic-token-"quoted"';
  const leaked = { ...request, message: `Create Synthetic Customer with reviewer@example.test ${secret}`,
    requested_schema: { properties: { [secret]: { description: secret } } } };
  const response = { action: "accept", content: { nested: { value: secret } } };
  const script = scriptedElicitations({ elicitations: [{ ...entry, response }] }, [secret]);
  assert.deepEqual(script.respond(leaked), response);
  script.finish();
  assert.ok(!JSON.stringify(script.evidence).includes(JSON.stringify(secret).slice(1, -1)));
  assert.equal(script.evidence[0].response.content.nested.value, "[REDACTED]");
  assert.equal(script.evidence[0].requestedSchema.properties["[REDACTED]"].description, "[REDACTED]");
  const rejected = scriptedElicitations({}, [secret]);
  assert.throws(() => rejected.respond(leaked), /Unexpected/);
  assert.ok(!JSON.stringify(rejected.evidence).includes(JSON.stringify(secret).slice(1, -1)));
});
