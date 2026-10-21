import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";

const image = "postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
const name = `emseepea-delivery-${randomUUID()}`;
const port = await availablePort();
const project = resolve(import.meta.dirname, "../../..");

let exitCode = 1;
let containerId;
try {
  const started = await output("docker", [
    "run", "--rm", "--detach", "--name", name,
    "--health-cmd", "pg_isready -U postgres",
    "--health-interval", "1s", "--health-timeout", "3s", "--health-retries", "20",
    "-e", "POSTGRES_PASSWORD=synthetic-fixture-not-a-secret",
    "-p", `127.0.0.1:${port}:5432`, image,
  ], 120_000);
  containerId = started.trim();
  if (!/^[a-f0-9]{64}$/.test(containerId)) {
    containerId = undefined;
    throw new Error("Docker returned an invalid PostgreSQL delivery fixture identity");
  }
  await waitUntilHealthy();
  exitCode = await run(process.execPath, [
    resolve(import.meta.dirname, "events-postgres-delivery.integration.mjs"),
    project,
    String(port),
  ], 120_000);
} finally {
  if (containerId) await run("docker", ["stop", containerId], 30_000);
}
process.exitCode = exitCode;

function run(executable, args, timeout) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, { stdio: "inherit" });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolveRun(code ?? 1);
    });
  });
}

async function waitUntilHealthy() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const status = await output("docker", [
      "inspect", "--format", "{{.State.Health.Status}}", name,
    ], 5_000);
    if (status.trim() === "healthy") return;
    if (status.trim() === "unhealthy") break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("PostgreSQL delivery fixture did not become healthy");
}

function output(executable, args, timeout) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveOutput(stdout);
      else reject(new Error("Could not inspect the PostgreSQL delivery fixture"));
    });
  });
}

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else if (address && typeof address === "object") resolvePort(address.port);
        else reject(new Error("Could not choose a PostgreSQL delivery fixture port"));
      });
    });
  });
}
