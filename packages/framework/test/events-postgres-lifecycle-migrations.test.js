import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresEventLifecycleMigrator } from "../dist/events-postgres-lifecycle-migrations.js";

test("lifecycle migration rejects an unavailable pool", () => {
  assert.throws(
    () => createPostgresEventLifecycleMigrator(undefined),
    (error) => error?.code === "UNAVAILABLE" && error?.phase === "lifecycle",
  );
});
