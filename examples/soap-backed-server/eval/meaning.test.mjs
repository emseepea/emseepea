import test from "node:test";
import {
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";
import { startSoapFixture } from "../test-support/soap-fixture.mjs";

test("retrieves a pea variety from SOAP through a natural request", async (t) => {
  const fixture = await startSoapFixture(t);
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
    environment: { PEA_SOAP_URL: fixture.url.href },
  });

  // One turn covers the example's only model-visible decision. XML validation
  // belongs in deterministic tests and would only waste model calls here.
  const result = await chat.send("Tell me about the Sugar Ann pea variety.");
  assertToolCalls(result, [{ name: "get-pea-variety", arguments: { name: "Sugar Ann" } }]);
  await assertResponseMeaning(result, {
    expected:
      "Sugar Ann is a snap pea that typically matures in 56 days. " +
      "It is an early bush variety with compact plants and edible pods.",
  });
});
