import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createDemoAuth } from "../events/auth.mjs";
import { startTelemetryProbe } from "./probe.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

export async function startOwnedProbe({ publicMcpUrl, publicAuthUrl, pin, evidenceFile,
  runId = randomUUID(), mcpPort = 3101, authPort = 3102 }) {
  if (!(publicMcpUrl instanceof URL) || !(publicAuthUrl instanceof URL)
    || [publicMcpUrl, publicAuthUrl].some((url) => url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    || publicMcpUrl.pathname !== "/mcp" || publicAuthUrl.pathname !== "/"
    || typeof pin !== "string" || pin.length < 12) {
    throw new Error("Use owned HTTPS /mcp and OAuth base URLs, and a temporary 12+ character PIN");
  }
  const outputRelative = typeof evidenceFile === "string" ? relative(root, evidenceFile) : "";
  if (typeof evidenceFile !== "string" || !isAbsolute(evidenceFile)
    || !(outputRelative === ".." || outputRelative.startsWith(`..${sep}`) || isAbsolute(outputRelative))) {
    throw new Error("Use an absolute private evidence path outside this repository");
  }
  const auth = createDemoAuth({ issuer: publicAuthUrl.origin, resource: publicMcpUrl.href,
    pin, signingKey: randomBytes(32) });
  const probe = await startTelemetryProbe({ runId, endpoint: publicMcpUrl, port: mcpPort,
    provenance: "native-pending",
    authentication: {
      verifier: { verifyAccessToken(token) {
        try { return auth.verifyAccessToken(token); }
        catch { throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid synthetic probe token"); }
      } },
      metadata: { resourceServerUrl: publicMcpUrl, oauthMetadata: auth.metadata },
    },
  });
  try {
    await new Promise((resolveListen, reject) => {
      auth.server.once("error", reject);
      auth.server.listen(authPort, "127.0.0.1", resolveListen);
    });
  } catch (error) { await probe.close(); throw error; }
  let stopping;
  return {
    runId, mcpUrl: probe.url, authPort: auth.server.address().port,
    stop() {
      return stopping ??= (async () => {
        let evidence;
        try { evidence = await probe.close(); }
        finally { await new Promise((resolveClose) => auth.server.close(resolveClose)); }
        await mkdir(dirname(evidenceFile), { recursive: true, mode: 0o700 });
        // Do not overwrite a previous evidence file or follow a file symlink.
        await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
        return evidenceFile;
      })();
    },
  };
}

async function main() {
  const required = (name) => {
    const value = process.env[name];
    if (!value) throw new Error(`Set ${name}`);
    return value;
  };
  const running = await startOwnedProbe({
    publicMcpUrl: new URL(required("OTEL_PROBE_MCP_URL")),
    publicAuthUrl: new URL(required("OTEL_PROBE_AUTH_URL")),
    pin: required("OTEL_PROBE_PIN"), evidenceFile: required("OTEL_PROBE_EVIDENCE_FILE"),
    ...(process.env.OTEL_PROBE_RUN_ID ? { runId: process.env.OTEL_PROBE_RUN_ID } : {}),
  });
  console.log(`Synthetic run ID: ${running.runId}`);
  console.log(`MCP listening at ${running.mcpUrl}; OAuth listening on 127.0.0.1:${running.authPort}`);
  console.log("Native support remains UNKNOWN until the owned ChatGPT journey and authenticated observations are verified.");
  let stop;
  const finish = () => {
    stop ??= running.stop().then(() => console.log("Probe stopped; private evidence saved."))
      .catch(() => { console.error("Probe stopped; evidence save was incomplete."); process.exitCode = 1; });
  };
  process.once("SIGINT", finish);
  process.once("SIGTERM", finish);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Probe could not start; check the owned endpoint, private output and PIN configuration."); process.exitCode = 1; });
}
