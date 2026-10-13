import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { trackBenchmarkChild } from "../../benchmarks/benchmark-child.mjs";

async function fixture(t, source, timeoutMs = 500) {
  const directory = await mkdtemp(join(tmpdir(), "benchmark-child-"));
  const file = join(directory, "child.cjs");
  await writeFile(file, source);
  const child = fork(file, [], { execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const tracked = trackBenchmarkChild(child, { timeoutMs });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); await rm(directory, { recursive: true, force: true }); });
  return { child, tracked };
}

test("early exit retains terminal state without unhandled shutdown rejection", async (t) => {
  const { tracked } = await fixture(t, "process.exit(7)");
  await assert.rejects(tracked.ready(), /exited/);
  await assert.rejects(tracked.shutdown(), /cleanly/);
});

test("normal IPC shutdown waits for clean exit and retains its receipt", async (t) => {
  const { tracked } = await fixture(t, `process.send({type:'ready'}); process.on('message', ({id,type}) => {
    process.send({id,value:{diagnosticOnly:true}}); if(type==='shutdown') process.disconnect();
  });`);
  await tracked.ready();
  assert.deepEqual(await tracked.shutdown(), { diagnosticOnly: true });
});

test("exit during IPC rejects the request and cleanup remains bounded", async (t) => {
  const { tracked } = await fixture(t, "process.send({type:'ready'}); process.on('message', () => process.exit(9));");
  await tracked.ready();
  await assert.rejects(tracked.ask("cpu-start"), /exited/);
  await assert.rejects(tracked.shutdown(), /cleanly/);
});

test("unresponsive shutdown escalates termination and never qualifies", async (t) => {
  const { child, tracked } = await fixture(t, "process.send({type:'ready'}); process.on('SIGTERM',()=>{}); process.on('message',()=>{});", 200);
  await tracked.ready();
  await assert.rejects(tracked.shutdown(), /timed out/);
  assert.equal(child.signalCode, "SIGKILL");
});

test("cancellation before readiness terminates the child and fails closed", async (t) => {
  const { child, tracked } = await fixture(t, "setInterval(()=>{},1000);");
  const ready = tracked.ready();
  child.kill("SIGTERM");
  await assert.rejects(ready, /exited/);
  await assert.rejects(tracked.shutdown(), /cleanly/);
});
