import { createWebMcpBridge } from "../test-support/webmcp-bridge.mjs";

const running = await createWebMcpBridge({ evidenceFile: process.env.WEBMCP_EVIDENCE_FILE });
// The harness discovers only this endpoint, never the website's backend endpoint.
console.log(running.url.href);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  void running.close().then(() => process.exit(0), () => process.exit(1));
});
