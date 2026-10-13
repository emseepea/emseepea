import { performance, PerformanceObserver } from "node:perf_hooks";

// Diagnostic observations share Node's performance clock. They never classify
// a budget population and must not substitute for uninstrumented measurements.
export function createDiagnosticClock() {
  const garbageCollections = [];
  const cpuWindows = [];
  let overflow = false;
  let start;
  let innerStart;
  let innerEnd;
  let finished;
  const retain = (entries) => {
    for (const entry of entries) {
      if (garbageCollections.length >= 4096) { overflow = true; continue; }
      garbageCollections.push({ startMs: entry.startTime, durationMs: entry.duration,
        kind: entry.detail.kind, flags: entry.detail.flags });
    }
  };
  const observer = new PerformanceObserver((list) => retain(list.getEntries()));
  observer.observe({ entryTypes: ["gc"] });
  const assertOpen = () => {
    if (finished) throw new Error("Diagnostic clock is finished");
  };
  return {
    start() {
      assertOpen();
      if (start !== undefined) throw new Error("Diagnostic CPU window is already active");
      start = performance.now();
    },
    started() {
      assertOpen();
      if (start === undefined || innerStart !== undefined) throw new Error("Diagnostic CPU start is out of order");
      innerStart = performance.now();
    },
    stopping() {
      assertOpen();
      if (innerStart === undefined || innerEnd !== undefined) throw new Error("Diagnostic CPU stop is out of order");
      innerEnd = performance.now();
    },
    stop() {
      assertOpen();
      if (start === undefined || innerStart === undefined || innerEnd === undefined) {
        throw new Error("Diagnostic CPU window has incomplete clock bounds");
      }
      // The outer interval brackets both CPU readings. The inner interval is
      // definitely between them; observations in the margins remain uncertain.
      const endMs = performance.now();
      if (cpuWindows.length >= 4096) overflow = true;
      else cpuWindows.push({ index: cpuWindows.length, startMs: start, innerStartMs: innerStart,
        innerEndMs: innerEnd, endMs });
      start = undefined;
      innerStart = undefined;
      innerEnd = undefined;
    },
    async finish() {
      if (finished) return finished;
      finished = (async () => {
        // GC entries are delivered asynchronously. Drain before disconnecting;
        // overflow remains explicit rather than silently implying no GC.
        await new Promise((resolve) => setImmediate(resolve));
        retain(observer.takeRecords());
        observer.disconnect();
        return { diagnosticOnly: true, clock: "node-performance", timeOriginMs: performance.timeOrigin,
          overflow, incompleteWindow: start !== undefined, cpuWindows, garbageCollections };
      })();
      return finished;
    },
  };
}
