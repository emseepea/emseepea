import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://emseepea:emseepea@127.0.0.1:5432/emseepea";
const serverPath = fileURLToPath(new URL("./server.js", import.meta.url));
const children = [start("instance-a"), start("instance-b")];

function start(instanceName: string): ChildProcess {
  return fork(serverPath, [], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      EMSEEPEA_INSTANCE: instanceName,
      PORT: "0",
    },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
}

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(children.map((child) => new Promise<void>((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", () => resolve());
  })));
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
