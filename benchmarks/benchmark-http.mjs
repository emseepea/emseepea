export function readBenchmarkResponse(incoming) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    incoming.on("data", (chunk) => chunks.push(chunk));
    incoming.once("end", () => resolve(Buffer.concat(chunks)));
    incoming.once("aborted", () => reject(new Error("Benchmark response was aborted")));
    incoming.once("error", reject);
  });
}
