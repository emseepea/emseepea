import { fork, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "emseepea-multi-instance-"));
const databasePath = join(directory, "reports.sqlite");
const serverPath = fileURLToPath(new URL("./server.js", import.meta.url));
const children = [start("instance-a"), start("instance-b")];

function start(instanceName: string): ChildProcess {
  return fork(serverPath, [], {
    env: {
      ...process.env,
      EMSEEPEA_DATABASE: databasePath,
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
  await rm(directory, { recursive: true, force: true });
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
