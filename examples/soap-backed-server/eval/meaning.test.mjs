import test from "node:test";
import {
  assertNoNegativeFeedback,
  assertResponseMeaning,
  assertToolCallsWithOptionalFeedback,
  createConversation,
} from "@emseepea/testing/semantic";
import { startSoapFixture } from "../test-support/soap-fixture.mjs";

const server = new URL(import.meta.resolve("@emseepea/feedback/testing-server"));

test("retrieves a pea variety from SOAP through a natural request", async (t) => {
  const fixture = await startSoapFixture(t);
  const chat = await createConversation(t, {
    server,
    environment: {
      PEA_SOAP_URL: fixture.url.href,
      EMSEEPEA_EVAL_APP_MODULE: new URL("../dist/app.js", import.meta.url).href,
      EMSEEPEA_EVAL_APP_FACTORY: "createSoapExample",
      EMSEEPEA_EVAL_APP_KIND: "soap",
    },
  });

  // One turn covers the example's only model-visible decision. XML validation
  // belongs in deterministic tests and would only waste model calls here.
  const result = await chat.send("Tell me about the Sugar Ann pea variety.");
  await assertToolCallsWithOptionalFeedback(result, [{
    name: "get-pea-variety",
    arguments: { name: "Sugar Ann" },
  }]);
  await assertResponseMeaning(result, {
    expected:
      "Sugar Ann is a snap pea that typically matures in 56 days. " +
      "It is an early bush variety with compact plants and edible pods.",
  });
  assertNoNegativeFeedback(result);
});
