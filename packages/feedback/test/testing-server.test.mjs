import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("the semantic testing server closes an app factory provider", { timeout: 15_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-feedback-close-"));
  const marker = path.join(directory, "closed.txt");
  const child = spawn(process.execPath, [fileURLToPath(new URL("../dist/testing-server.js", import.meta.url))], {
    env: {
      ...process.env,
      PORT: "0",
      EMSEEPEA_CLOSE_MARKER: marker,
      EMSEEPEA_EVAL_APP_MODULE: new URL("./fixtures/testing-server-app.mjs", import.meta.url).href,
      EMSEEPEA_EVAL_APP_FACTORY: "createTestingServerFixture",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  try {
    await waitFor(() => output.includes("listening at"), () => errors);
    child.kill("SIGTERM");
    const exit = await new Promise((resolve) => child.once("close", resolve));
    assert.equal(exit, 0);
    assert.equal(await readFile(marker, "utf8"), "closed\n");
  } finally {
    child.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});

async function waitFor(predicate, failure) {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`testing server did not start: ${failure()}`);
}
