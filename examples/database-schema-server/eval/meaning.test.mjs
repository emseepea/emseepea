import test from "node:test";
import {
  assertNoNegativeFeedback,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

const server = new URL(import.meta.resolve("@emseepea/feedback/testing-server"));
const appModule = new URL("../dist/app.js", import.meta.url).href;

const trialDatabaseUrls = [1, 2, 3].map((trial) => {
  const value = process.env[`DATABASE_URL_TRIAL_${trial}`];
  if (!value) throw new Error(`DATABASE_URL_TRIAL_${trial} is required`);
  return value;
});

test("finds and adds pea varieties through natural requests", async (t) => {
  const chat = await createConversation(t, {
    server,
    environment: (trial) => ({
      DATABASE_URL: trialDatabaseUrls[trial - 1],
      EMSEEPEA_EVAL_APP_MODULE: appModule,
      EMSEEPEA_EVAL_APP_FACTORY: "createDatabaseSchemaExample",
      EMSEEPEA_EVAL_APP_KIND: "postgres",
    }),
  });

  // One read and one write show both important selection decisions. Procedure
  // selection stays in ordinary tests because a third model turn adds cost but
  // does not teach a meaningfully different MCP interaction.
  const fastest = await chat.send("Which snap pea variety matures fastest?");
  assertToolCalls(fastest, [{
    name: "list-pea-varieties",
    arguments: { pea_type: "snap" },
  }]);
  await assertResponseMeaning(fastest, {
    expected: "Sugar Ann is the fastest listed snap pea variety and matures in 56 days.",
  });

  const added = await chat.send(
    "Add Golden Sweet as a climbing mangetout pea that matures in 70 days. " +
    "Use exactly mangetout as its pea type. Its notes are: Purple flowers and flat edible pods.",
  );
  assertToolCalls(added, [{
    name: "add-pea-variety",
    arguments: {
      name: "Golden Sweet",
      pea_type: "mangetout",
      growth_habit: "climbing",
      days_to_maturity: 70,
      notes: "Purple flowers and flat edible pods.",
    },
  }]);
  assertResponseContains(added, ["Golden Sweet", "mangetout", "70"]);
  assertNoNegativeFeedback(fastest, added);
});
