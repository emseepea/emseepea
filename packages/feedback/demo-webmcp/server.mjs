import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createEmseepea, serveEmseepea } from "@emseepea/server";
import { z } from "zod";
import { defineFeedbackSubmission } from "../dist/index.js";

/** Loopback, synthetic demonstration. Records last only for this process. */
export async function createDemo({ port = 0, authentication, configureApp, submit } = {}) {
  const records = [];
  const feedback = defineFeedbackSubmission({
    access: authentication ? "protected" : "public",
    ...(authentication ? { requiredScopes: ["feedback:write"] } : {}),
    scope: authentication ? (principal) => principal.subject ?? principal.clientId : "website-demo",
    contextSchema: z.strictObject({
      feature: z.enum(["variety-search"]).describe("The explicitly selected application feature."),
    }),
    backend: {
      async submit(command, context) {
        context.signal.throwIfAborted();
        if (submit) await submit(command, context);
        context.signal.throwIfAborted();
        const receipt = { id: randomUUID(), recordedAt: new Date().toISOString() };
        records.push({ ...receipt, scope: context.scope, ...structuredClone(command) });
        return receipt;
      },
    },
  });
  const app = createEmseepea({
    name: "webmcp-feedback-demo", version: "0.0.0", tools: [feedback],
    ...(authentication ? { authentication } : {}),
  });
  // Test fixtures can add authentication plumbing; the public demo has no login system.
  configureApp?.(app);
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./browser.mjs", import.meta.url))],
    bundle: true, write: false, platform: "browser", format: "esm", target: "es2023",
  });
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  app.get("/", (_request, reply) => reply.type("text/html; charset=utf-8").send(html));
  app.get("/browser.js", (_request, reply) => reply.type("text/javascript; charset=utf-8").send(bundle.outputFiles[0].text));
  app.get("/favicon.ico", (_request, reply) => reply.code(204).send());
  const running = await serveEmseepea(app, { port, host: "127.0.0.1" });
  return { ...running, origin: running.url.origin, records };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const running = await createDemo({ port: Number(process.env.PORT ?? 3000) });
  console.log(`WebMCP feedback demo: ${running.origin}`);
  console.log("Synthetic data only. Feedback is held in memory and cleared when the server stops.");
  process.once("SIGINT", () => void running.close());
  process.once("SIGTERM", () => void running.close());
}
