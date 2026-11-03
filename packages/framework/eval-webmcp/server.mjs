import { createNativeWebMcpBridge } from "../test-support/webmcp-semantic-bridge.mjs";

const fixture = await createNativeWebMcpBridge({ evidenceFile: process.env.WEBMCP_EVIDENCE_FILE });
console.log(fixture.url.href);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  void fixture.close().then(() => process.exit(0), () => process.exit(1));
});
