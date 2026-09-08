import test from "node:test";
import {
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the PostgreSQL semantic test");

test("saves and retrieves a harvest report without exposing server instances", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
    environment: { DATABASE_URL: databaseUrl },
  });

  // Two natural turns cover write and read tool selection at low model cost.
  // Cross-process behavior stays in ordinary tests because a model cannot
  // prove which process served a request.
  const saved = await chat.send(
    "Save a harvest report for North Bed on 2026-09-08 with 12 shelling pea " +
    "plants and 8 snap pea plants.",
  );
  assertToolCalls(saved, [
    {
      name: "save-harvest-report",
      arguments: {
        gardenBed: "North Bed",
        harvestDate: "2026-09-08",
        shellingCount: 12,
        snapCount: 8,
      },
    },
  ]);
  assertResponseContains(saved, ["North Bed", "12", "8", "20"]);

  const retrieved = await chat.send(
    "What harvest report do we have for that garden bed and date?",
  );
  assertToolCalls(retrieved, [
    {
      name: "get-harvest-report",
      arguments: { gardenBed: "North Bed", harvestDate: "2026-09-08" },
    },
  ]);
  await assertResponseMeaning(retrieved, {
    expected:
      "The saved report for North Bed on 2026-09-08 has 12 shelling pea plants, " +
      "8 snap pea plants, and 20 plants in total.",
  });
});
