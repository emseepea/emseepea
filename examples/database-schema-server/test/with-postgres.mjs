import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { basename } from "node:path";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A test command is required");

const project = `emseepea-database-schema-test-${process.pid}`;
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
  const environment = {
    ...process.env,
    DATABASE_URL: `postgres://emseepea:emseepea@127.0.0.1:${port}/emseepea`,
  };
  if (basename(command) === "emseepea-test") {
    for (let trial = 1; trial <= 3; trial += 1) {
      const name = `emseepea_trial_${trial}`;
      if (await compose("exec", "-T", "database", "createdb", "-U", "emseepea", name) !== 0
        || await compose(
          "exec", "-T", "database", "psql", "-U", "emseepea", "-d", name,
          "-v", "ON_ERROR_STOP=1", "-f", "/docker-entrypoint-initdb.d/001-schema.sql",
        ) !== 0) {
        throw new Error(`Could not prepare PostgreSQL semantic trial ${trial}`);
      }
      environment[`DATABASE_URL_TRIAL_${trial}`] =
        `postgres://emseepea:emseepea@127.0.0.1:${port}/${name}`;
    }
  }
  exitCode = await run(command, args, environment);
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
