import { createEmseepea, serveEmseepea } from "@emseepea/server";

const running = await serveEmseepea(createEmseepea({
  name: "testing-protocol-fixture",
  version: "0.0.0",
}), { port: 0 });

console.log(`Testing protocol fixture listening at ${running.url}`);
