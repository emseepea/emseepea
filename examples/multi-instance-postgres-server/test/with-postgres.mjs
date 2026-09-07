import { spawn } from "node:child_process";
import { createServer } from "node:net";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A test command is required");

const project = `emseepea-test-${process.pid}`;
const port = await availablePort();
const composeEnvironment = { ...process.env, POSTGRES_PORT: String(port) };
const compose = (...composeArgs) => run(
  "docker",
  ["compose", "--project-name", project, ...composeArgs],
  composeEnvironment,
  120_000,
);

let exitCode = 1;
try {
  if (await compose("up", "--detach", "--wait", "database") !== 0) {
    throw new Error("Could not start the PostgreSQL test service");
  }
  exitCode = await run(command, args, {
    ...process.env,
    DATABASE_URL: `postgres://emseepea:emseepea@127.0.0.1:${port}/emseepea`,
  });
} finally {
  await compose("down", "--volumes");
}
process.exitCode = exitCode;

function run(executable, executableArgs, env, timeout = 600_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, executableArgs, { env, stdio: "inherit" });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not choose a PostgreSQL test port"));
      });
    });
  });
}
