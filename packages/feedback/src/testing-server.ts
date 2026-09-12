import { randomUUID } from "node:crypto";
import { serveEmseepea } from "@emseepea/server";
import { defineFeedbackSubmission } from "./index.js";

const appModule = process.env.EMSEEPEA_EVAL_APP_MODULE;
const factoryName = process.env.EMSEEPEA_EVAL_APP_FACTORY;
const kind = process.env.EMSEEPEA_EVAL_APP_KIND ?? "options";
if (!appModule || !factoryName) throw new Error("Example eval app factory is required");

const factory: unknown = (await import(appModule))[factoryName];
if (typeof factory !== "function") throw new Error("Example eval app factory was not exported");
const feedback = defineFeedbackSubmission({
  access: "public",
  backend: {
    submit: () => ({ id: randomUUID(), recordedAt: new Date().toISOString() }),
  },
});
const extensions = { additionalTools: [feedback] };
const created: unknown = kind === "postgres"
  ? await factory({ databaseUrl: process.env.DATABASE_URL, ...extensions })
  : kind === "mongodb"
    ? await factory({ uri: process.env.MONGODB_URL, ...extensions })
    : kind === "soap"
      ? await factory(process.env.PEA_SOAP_URL, extensions)
      : await factory(extensions);
if (!created || typeof created !== "object") throw new Error("Example eval app factory returned no app");
const app = "app" in created ? created.app : created;
const closeProvider = "closeProvider" in created && typeof created.closeProvider === "function"
  ? created.closeProvider.bind(created)
  : undefined;
const running = await serveEmseepea(app as Parameters<typeof serveEmseepea>[0], {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

async function shutdown() {
  try {
    await running.close();
  } finally {
    await closeProvider?.();
  }
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
console.log(`Feedback-enabled example eval server listening at ${running.url}`);
