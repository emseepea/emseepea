import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createEmseepea, loadDeploymentProfile, serveEmseepea } from "@emseepea/server";

const validConfig = {
  allowedAuthorities: ["mcp.example.com"],
  allowedOrigins: ["https://mcp.example.com"],
  trustedProxyAddresses: ["127.0.0.1"],
  rateLimit: { maxRequests: 100, windowMs: 60_000, maxClients: 1_000 },
};

test("deployment environment is loopback by default and fail-closed in production", async (t) => {
  assert.deepEqual(loadDeploymentProfile({}), { mode: "loopback" });
  assert.throws(() => loadDeploymentProfile({ EMSEEPEA_DEPLOYMENT_MODE: "production-behind-proxy" }), /absolute file path/);
  assert.throws(() => loadDeploymentProfile({ EMSEEPEA_DEPLOYMENT_CONFIG_FILE: "/tmp/config.json" }), /explicit deployment mode/);
  assert.throws(() => loadDeploymentProfile({ EMSEEPEA_DEPLOYMENT_MODE: "public" }), /Unsupported deployment mode/);

  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-deployment-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "deployment.json");
  const environment = {
    EMSEEPEA_DEPLOYMENT_MODE: "production-behind-proxy",
    EMSEEPEA_DEPLOYMENT_CONFIG_FILE: configPath,
  };

  await writeFile(configPath, JSON.stringify(validConfig));
  assert.deepEqual(loadDeploymentProfile(environment), {
    mode: "production-behind-proxy",
    ...validConfig,
  });

  for (const invalid of [
    { ...validConfig, unexpected: true },
    { ...validConfig, allowedAuthorities: ["mcp.example.com", "MCP.EXAMPLE.COM"] },
    { ...validConfig, allowedOrigins: ["https://mcp.example.com", "https://MCP.EXAMPLE.COM"] },
    { ...validConfig, trustedProxyAddresses: ["::ffff:127.0.0.1"] },
    { ...validConfig, trustedProxyAddresses: ["127.0.0.1/32"] },
    { ...validConfig, rateLimit: { ...validConfig.rateLimit, maxRequests: 0 } },
  ]) {
    await writeFile(configPath, JSON.stringify(invalid));
    assert.throws(() => loadDeploymentProfile(environment));
  }

  await writeFile(configPath, Buffer.from([0xff]));
  assert.throws(() => loadDeploymentProfile(environment));
  await writeFile(configPath, " ".repeat(16 * 1024 + 1));
  assert.throws(() => loadDeploymentProfile(environment), /exceeds 16 KiB/);
});

test("production deployment binds publicly only when explicitly selected", async (t) => {
  const app = createEmseepea({ name: "deployment-test", version: "0.0.0", deployment: { mode: "production-behind-proxy", ...validConfig } });
  const running = await serveEmseepea(app, { port: 0 });
  t.after(() => running.close());
  assert.equal(running.url.hostname, "0.0.0.0");
});
