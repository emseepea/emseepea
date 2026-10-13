// Lifetime tracking is installed before any readiness or measurement wait.
// Exit resolves rather than rejects, so an early exit cannot become unhandled.
export function trackBenchmarkChild(child, { timeoutMs = 5_000 } = {}) {
  let terminal;
  let nextId = 0;
  const exited = new Promise((resolve) => {
    const finish = (value) => { terminal ??= value; resolve(terminal); };
    child.once("exit", (code, signal) => finish({ code, signal }));
    child.once("error", (error) => finish({ error: error.message }));
  });
  const wait = (predicate, send) => new Promise((resolve, reject) => {
    if (terminal || !child.connected) return reject(new Error("Benchmark server is unavailable"));
    const cleanup = () => { clearTimeout(timer); child.off("message", onMessage); child.off("exit", onExit); child.off("error", onExit); };
    const fail = (error) => { cleanup(); reject(error); };
    const onMessage = (message) => {
      if (!predicate(message)) return;
      cleanup();
      if (message.error) reject(new Error(message.error));
      else resolve(message);
    };
    const onExit = () => fail(new Error("Benchmark server exited before completing the request"));
    const timer = setTimeout(() => fail(new Error("Benchmark server IPC timed out")), timeoutMs);
    child.on("message", onMessage);
    child.once("exit", onExit);
    child.once("error", onExit);
    send?.((error) => { if (error) fail(error); });
  });
  const ask = async (type) => {
    const id = ++nextId;
    return (await wait((message) => message?.id === id,
      (callback) => child.send({ id, type }, callback))).value;
  };
  const boundedExit = async () => {
    if (terminal) return terminal;
    let timer;
    const result = await Promise.race([exited, new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    })]);
    clearTimeout(timer);
    return result;
  };
  return {
    ask,
    ready: () => wait((message) => message?.type === "ready"),
    async shutdown() {
      let clock;
      let failure;
      try { if (!terminal && child.connected) clock = await ask("shutdown"); }
      catch (error) { failure = error; }
      let result = await boundedExit();
      if (!result) {
        child.kill("SIGTERM");
        result = await boundedExit();
      }
      if (!result) {
        child.kill("SIGKILL");
        result = await boundedExit();
      }
      if (failure) throw failure;
      if (!result || result.error || result.code !== 0) throw new Error("Benchmark server shutdown did not complete cleanly");
      return clock;
    },
  };
}
