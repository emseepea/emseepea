import { appendFile } from "node:fs/promises";
import { createEmseepea } from "@emseepea/server";

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
