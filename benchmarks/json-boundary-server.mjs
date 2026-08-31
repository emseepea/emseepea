import { Session } from "node:inspector";
import { createEmseepea, defineMappedTool, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

const tool = defineMappedTool({
  name: "synthetic-read",
  access: "public",
  description: "Return one synthetic record.",
  inputSchema: z.object({ id: z.string().meta({ "x-mcp-header": "Id" }) }),
  outputSchema: z.object({ id: z.string(), value: z.string() }),
  backendInputSchema: z.object({ id: z.string() }),
  backendOutputSchema: z.object({ id: z.string(), value: z.string() }),
  mapInput: ({ id }) => ({ id }),
  adapter: ({ id }) => ({ id, value: "synthetic" }),
  mapOutput: (data) => ({ text: "synthetic", data }),
});
const app = createEmseepea({
  name: "emseepea-benchmark", version: "0.0.0", tools: [tool],
  telemetry: process.argv.includes("--telemetry"),
});
const running = await serveEmseepea(app, { port: 0 });
let cpuStart;
let allocationSession;

process.on("message", async ({ id, type }) => {
  try {
    let value;
    if (type === "cpu-start") cpuStart = process.cpuUsage();
    else if (type === "cpu-stop") {
      const cpu = process.cpuUsage(cpuStart);
      value = (cpu.user + cpu.system) / 1_000;
    } else if (type === "allocation-start") {
      allocationSession = new Session();
      allocationSession.connect();
      await inspector(allocationSession, "HeapProfiler.startSampling", { samplingInterval: 512 });
    } else if (type === "allocation-stop") {
      const { profile } = await inspector(allocationSession, "HeapProfiler.stopSampling");
      value = sumAllocations(profile.head);
      allocationSession.disconnect();
      allocationSession = undefined;
    } else if (type === "heap") {
      globalThis.gc();
      value = process.memoryUsage().heapUsed;
    } else if (type === "shutdown") {
      await running.close();
    }
    process.send({ id, value });
    if (type === "shutdown") process.disconnect();
  } catch (error) {
    process.send({ id, error: error instanceof Error ? error.message : String(error) });
  }
});

process.send({ type: "ready", url: running.url.href });

function inspector(session, method, params = {}) {
  return new Promise((resolve, reject) => session.post(method, params, (error, value) =>
    error ? reject(error) : resolve(value)));
}
function sumAllocations(node) {
  return node.selfSize + node.children.reduce((sum, child) => sum + sumAllocations(child), 0);
}
