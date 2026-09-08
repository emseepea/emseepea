import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

const trialUris = [1, 2, 3].map((trial) => {
  const value = process.env[`MONGODB_URL_TRIAL_${trial}`];
  if (!value) throw new Error(`MONGODB_URL_TRIAL_${trial} is required`);
  return value;
});

test("finds and adds MongoDB-backed pea varieties through natural requests", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
    environment: (trial) => ({ MONGODB_URL: trialUris[trial - 1] }),
  });

  // The read and write turns cover both public decisions. Storage validation
  // remains in deterministic tests because asking a model cannot prove it.
  const fastest = await chat.send("Among the saved snap pea varieties, which matures fastest?");
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

  // Two further turns cover the separate observation task. Database enforcement
  // stays in ordinary tests because a model conversation cannot prove it.
  const recorded = await chat.send(
    "Record that Golden Sweet was flowering in the west trellis on 2026-09-08. " +
    "The notes are: First flower opened.",
  );
  assertToolCalls(recorded, [{
    name: "record-pea-observation",
    arguments: {
      variety_name: "Golden Sweet",
      observed_on: "2026-09-08",
      location: "west trellis",
      growth_stage: "flowering",
      notes: "First flower opened.",
    },
  }]);

  const observations = await chat.send("What have I observed about Golden Sweet?");
  assertToolCalls(observations, [{
    name: "list-pea-observations",
    arguments: { variety_name: "Golden Sweet" },
  }]);
  await assertResponseMeaning(observations, {
    expected:
      "Golden Sweet was flowering in the west trellis on 8 September 2026, " +
      "and the first flower had opened.",
  });
});
