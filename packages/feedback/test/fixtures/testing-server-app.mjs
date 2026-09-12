import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { createEmseepea } from "@emseepea/server";

const log = console.log;
console.log = (...arguments_) => {
  if (String(arguments_[0]).includes("Feedback-enabled example eval server listening at")) {
    assert.ok(process.listenerCount("SIGINT") > 0);
    assert.ok(process.listenerCount("SIGTERM") > 0);
  }
  log(...arguments_);
};

export function createTestingServerFixture(extensions) {
  return {
    app: createEmseepea({
      name: "feedback-testing-server-fixture",
      version: "0.0.0",
      ...extensions,
    }),
    closeProvider: () => appendFile(process.env.EMSEEPEA_CLOSE_MARKER, "closed\n"),
  };
}
