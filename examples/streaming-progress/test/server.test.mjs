import assert from "node:assert/strict";
import test from "node:test";

import { startMcpServer } from "@emseepea/testing";

test("reports bounded progress before returning the final roast result", async (t) => {
  const running = await startMcpServer(t, new URL("../dist/server.js", import.meta.url));
  const client = await running.connect();
  const progress = [];
  const result = await client.callTool(
    { name: "roast-sample-batch", arguments: { batch: "sample-batch" } },
    { onprogress: (update) => progress.push(update) },
  );

  assert.deepEqual(progress.map(({ message }) => message), ["charge", "first crack", "cool"]);
  assert.deepEqual(result.structuredContent, {
    batch: "sample-batch",
    status: "complete",
    roastedGrams: 820,
    stages: ["charge", "first crack", "cool"],
  });
});
