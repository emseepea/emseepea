import { serveEmseepea } from "@emseepea/server";
import { insecureTestAuthentication } from "@emseepea/testing";
import { createToolServer } from "../dist/app.js";

const permissions = process.env.TEST_PERMISSIONS?.split(",").filter(Boolean) ?? [];
const app = await createToolServer({
  access: { access: "protected", requiredScopes: ["varieties:read"] },
  authentication: insecureTestAuthentication(permissions),
});
const running = await serveEmseepea(app, {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
});

console.log(`Protected tool eval server listening at ${running.url}`);

async function shutdown() {
  await running.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
