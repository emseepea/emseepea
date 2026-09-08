import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { basename } from "node:path";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A test command is required");

const project = `emseepea-mongodb-test-${process.pid}`;
const port = await availablePort();
const composeEnvironment = { ...process.env, MONGODB_PORT: String(port) };
const databaseUrl = `mongodb://127.0.0.1:${port}`;
const compose = (...composeArgs) => run(
  "docker",
  ["compose", "--project-name", project, ...composeArgs],
  composeEnvironment,
  180_000,
);

let exitCode = 1;
try {
  if (await compose("up", "--detach", "--wait", "database") !== 0) {
    throw new Error("Could not start the MongoDB test service");
  }
  const environment = { ...process.env, MONGODB_URL: databaseUrl };
  if (await run(process.execPath, ["dist/setup-database.js"], environment) !== 0) {
    throw new Error("Could not prepare the MongoDB test database");
  }
  if (basename(command) === "emseepea-test") {
    for (let trial = 1; trial <= 3; trial += 1) {
      const trialEnvironment = {
        ...environment,
        MONGODB_URL: `${databaseUrl}/emseepea_trial_${trial}`,
      };
      if (await run(process.execPath, ["dist/setup-database.js"], trialEnvironment) !== 0) {
        throw new Error(`Could not prepare MongoDB semantic trial ${trial}`);
      }
      environment[`MONGODB_URL_TRIAL_${trial}`] = trialEnvironment.MONGODB_URL;
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
        else reject(new Error("Could not choose a MongoDB test port"));
      });
    });
  });
}
