#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const [key, projectPath, tarballMapPath] = process.argv.slice(2);
const registryLock = process.argv.includes("--registry-lock");
assert.ok(key && projectPath && (registryLock || tarballMapPath),
  "usage: verify-container-project <key> <project> <tarball-map.json> [--registry-lock]");
const root = fileURLToPath(new URL("../", import.meta.url));
const project = path.resolve(projectPath);
const tarballs = registryLock ? undefined : JSON.parse(await readFile(path.resolve(tarballMapPath), "utf8"));
const expectedNode = (await readFile(path.join(root, ".node-version"), "utf8")).trim();
const containerPort = key === "react-ui-server" ? 3001 : 3000;
const composeProject = `emseepea-container-${process.pid}-${key}`.replaceAll(/[^a-z0-9_-]/g, "-");
const network = `${composeProject}_default`;
const localImage = "emseepea-server:local";
const composeEnvironment = { COMPOSE_PROJECT_NAME: composeProject };
const databaseExamples = new Set(["database-schema-server", "mongodb-backed-server", "multi-instance-postgres-server"]);
const fixtureNetworks = {
  "api-backed-server": { subnet: "1.1.1.0/30", gateway: "1.1.1.1" },
  "openapi-backed-server": { subnet: "1.0.0.0/30", gateway: "1.0.0.1" },
};
const images = [];
const files = [];
let ownsNetwork = false;
let databaseStarted = false;
let fixture;
let fixtureDirectory;

try {
  const staged = registryLock ? await verifyRegistryLock() : await stageExactPackages();
  const secretCanary = "EMSEEPEA_CONTAINER_SECRET_CANARY_7d4e6f";
  const secretPath = path.join(project, ".env");
  files.push(secretPath);
  await writeFile(secretPath, `TOKEN=${secretCanary}\n`);
  await run("npm", ["run", "container:build"], project, {}, 900_000);
  if (!registryLock) {
    if (databaseExamples.has(key)) {
      await run("npm", ["run", "db:start"], project, composeEnvironment, 300_000);
      databaseStarted = true;
    } else {
      const fixtureNetwork = fixtureNetworks[key];
      await run("docker", ["network", "create",
        ...(fixtureNetwork ? ["--internal", "--subnet", fixtureNetwork.subnet, "--gateway", fixtureNetwork.gateway] : []),
        network], project);
      ownsNetwork = true;
    }
    const networkInspection = JSON.parse(await run("docker", ["network", "inspect", network], project))[0];
    const gateways = networkInspection.IPAM.Config.map(({ Gateway }) => Gateway)
      .filter((gateway) => typeof gateway === "string" && gateway.includes("."));
    assert.equal(gateways.length, 1, "container network must have exactly one IPv4 gateway");
    const [gateway] = gateways;
    const defaultNetworkInspection = JSON.parse(await run("docker", ["network", "inspect", "bridge"], project))[0];
    const protectedGateway = defaultNetworkInspection.IPAM.Config.map(({ Gateway }) => Gateway)
      .find((candidate) => typeof candidate === "string" && candidate.includes("."));
    assert.ok(protectedGateway, "default container network must have an IPv4 gateway");
    fixture = await startFixture();

    for (const target of [
      { platform: "linux/amd64", architecture: "amd64" },
      { platform: "linux/arm64/v8", architecture: "arm64" },
    ]) {
      const image = `emseepea-server:container-check-${target.architecture}`;
      images.push(image);
      await run("docker", [
        "buildx", "build", "--platform", target.platform, "--load", "--tag", image, ".",
      ], project, {}, 900_000);
      await verifyImage(image, target, secretCanary);
      await verifyRunningImage(image, target, gateway, protectedGateway);
    }

    if (key === "tool-server") {
      await rm(staged[0]);
      await assert.rejects(run("npm", ["run", "container:build"], project), /npm ci|ENOENT|not found|failed/i);
    }
  }
} finally {
  await fixture?.close();
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
  if (databaseStarted) await ignoreFailure("npm", ["run", "db:reset"], project, composeEnvironment);
  else if (ownsNetwork) await ignoreFailure("docker", ["network", "rm", network], project);
  for (const image of [localImage, ...images]) await ignoreFailure("docker", ["image", "rm", "--force", image], project);
  for (const file of files) await rm(file, { force: true });
}

async function verifyImage(image, { platform, architecture }, secretCanary) {
  const [inspection] = JSON.parse(await run("docker", ["image", "inspect", image], project));
  assert.equal(inspection.Architecture, architecture);
  assert.equal(inspection.Config.User, "65532:65532");
  assert.deepEqual(inspection.Config.Cmd, ["dist/server.js"]);
  assert.deepEqual(inspection.Config.Env.filter((value) => value.startsWith("EMSEEPEA_") || value.startsWith("NODE_ENV=")), [
    "EMSEEPEA_DEPLOYMENT_MODE=production-behind-proxy",
  ]);
  assert.ok(inspection.Config.Healthcheck?.Test?.includes("/nodejs/bin/node"));
  const dockerfile = await readFile(path.join(project, "Dockerfile"), "utf8");
  assert.ok(dockerfile.includes(`test "$(node --version)" = "v${expectedNode}"`));
  assert.equal((await run("docker", [
    "run", "--rm", "--platform", platform, "--entrypoint", "/nodejs/bin/node", image, "--version",
  ], project)).trim(), `v${expectedNode}`);
  const history = await run("docker", ["history", "--no-trunc", image], project);
  assert.doesNotMatch(history, new RegExp(secretCanary));
  assert.doesNotMatch(history, /(?:NPM_TOKEN|DATABASE_URL=|MONGODB_URL=|BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+[A-Za-z0-9])/i);
  const runtimeCheck = `
    const { existsSync } = require("node:fs");
    for (const forbidden of ["/app/.env", "/app/package-lock.json", "/app/src", "/app/test", "/app/.emseepea-packages", "/bin/sh", "/nodejs/bin/npm"]) {
      if (existsSync(forbidden)) throw new Error("runtime contains " + forbidden);
    }
    if (${JSON.stringify(key)} === "react-ui-server" && !existsSync("/app/dist/client.js")) throw new Error("React bundle missing");
    if (${JSON.stringify(key)} === "soap-backed-server" && !existsSync("/app/contracts/pea-service.wsdl")) throw new Error("SOAP contract missing");
    import("@emseepea/server");
  `;
  await run("docker", [
    "run", "--rm", "--platform", platform, "--entrypoint", "/nodejs/bin/node", image, "-e", runtimeCheck,
  ], project);
  for (const executable of ["/bin/sh", "/nodejs/bin/npm", "/usr/local/bin/npm", "/usr/bin/apt-get"]) {
    await assert.rejects(run("docker", [
      "run", "--rm", "--platform", platform, "--entrypoint", executable, image, "--version",
    ], project), /executable file not found|stat .*no such file|no such file/i);
  }
}

async function verifyRunningImage(image, target, gateway, protectedGateway) {
  await verifyProtectedBoundary(image, target, protectedGateway);
  await assert.rejects(run("docker", ["run", "--rm", "--platform", target.platform, image], project));
  const invalidPath = await writePolicy(`${target.architecture}-invalid`, "{\"unknown\":true}\n");
  await assert.rejects(run("docker", [
    "run", "--rm", "--platform", target.platform,
    "--mount", `type=bind,source=${invalidPath},target=/run/emseepea/deployment.json,readonly`,
    "-e", "EMSEEPEA_DEPLOYMENT_CONFIG_FILE=/run/emseepea/deployment.json", image,
  ], project));
  const wrongPolicy = await writePolicy(`${target.architecture}-wrong-proxy`, policy("192.0.2.1"));
  await withApp(image, target, wrongPolicy, async ({ proxyUrl }) => {
    assert.equal((await mcpCall(new URL("/mcp", proxyUrl))).status, 403);
  });
  const validPolicy = await writePolicy(`${target.architecture}-valid`, policy(gateway));
  await withApp(image, target, validPolicy, async ({ applicationUrl, proxyUrl, proxy }) => {
    await waitFor(new URL("/healthz", proxyUrl), 200);
    await waitFor(new URL("/readyz", proxyUrl), 200);
    const rejectedWorkBaseline = fixture.requests;
    assert.equal((await mcpCall(new URL("/mcp", applicationUrl))).status, 403, "direct proxy bypass was accepted");
    assert.equal((await mcpCall(new URL("/mcp", proxyUrl), { origin: "https://attacker.example" })).status, 403);
    assert.equal((await mcpCall(new URL("/mcp", proxyUrl), { "x-test-authority": "attacker.example" })).status, 403);
    assert.equal((await mcpCall(new URL("/mcp", proxyUrl), { "x-test-client": "203.0.113.10, 203.0.113.11" })).status, 403);
    assert.equal(fixture.requests, rejectedWorkBaseline, "rejected boundary input reached the dependency fixture");
    const accepted = await mcpCall(new URL("/mcp", proxyUrl), {
      authorization: "Bearer unchanged-by-proxy", origin: "https://mcp.example.com",
    }, key === "resources-and-prompts-server" ? "resources/list" : "tools/list");
    assert.equal(accepted.status, 200);
    const catalogue = (await accepted.json()).result;
    assert.ok(Array.isArray(key === "resources-and-prompts-server" ? catalogue.resources : catalogue.tools));
    assert.equal(proxy.forwardedAuthorization, "Bearer unchanged-by-proxy");
    await verifyJourney(new URL("/mcp", proxyUrl), fixture.requests);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if ((await mcpCall(new URL("/mcp", proxyUrl))).status === 429) break;
      if (attempt === 4) assert.fail("rate limit was not enforced");
    }
    assert.equal((await mcpCall(new URL("/mcp", proxyUrl), { "x-test-client": "203.0.113.11" })).status, 503);
  });
}

async function verifyProtectedBoundary(image, target, protectedGateway) {
  const container = `${composeProject}-${target.architecture}-protected`;
  let proxy;
  const script = `
    import { createEmseepea, defineTool, serveEmseepea } from "@emseepea/server";
    import { z } from "zod";
    let calls = 0;
    const resourceServerUrl = new URL("https://mcp.example.com/mcp");
    const app = createEmseepea({
      name: "container-protected-check", version: "0.0.0",
      tools: [defineTool({ name: "protected-check", access: "protected", requiredScopes: ["read"],
        description: "Verify access ordering.", inputSchema: z.object({}), outputSchema: z.object({ ok: z.literal(true) }),
        handler: () => { calls += 1; return { data: { ok: true } }; } })],
      authentication: {
        verifier: { verifyAccessToken: async (token) => ({ token, clientId: "container-check",
          scopes: token === "allowed" ? ["read"] : ["other"], expiresAt: Math.floor(Date.now() / 1000) + 60,
          resource: resourceServerUrl }) },
        metadata: { resourceServerUrl, oauthMetadata: { issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize", token_endpoint: "https://auth.example/token",
          response_types_supported: ["code"] } },
      },
      deployment: { mode: "production-behind-proxy", allowedAuthorities: ["mcp.example.com"],
        allowedOrigins: ["https://mcp.example.com"], trustedProxyAddresses: [${JSON.stringify(protectedGateway)}],
        rateLimit: { maxRequests: 10, windowMs: 60000, maxClients: 1 } },
    });
    const running = await serveEmseepea(app, { host: "0.0.0.0", port: ${containerPort} });
    process.once("SIGTERM", async () => { console.log("HANDLER_CALLS=" + calls); await running.close(); });
  `;
  try {
    await run("docker", [
      "run", "--detach", "--name", container, "--platform", target.platform,
      "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m", "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges", "--publish", `127.0.0.1::${containerPort}`,
      "--entrypoint", "/nodejs/bin/node", image, "--input-type=module", "-e", script,
    ], project);
    const published = (await run("docker", ["port", container, `${containerPort}/tcp`], project)).trim();
    const applicationUrl = new URL(`http://${published.replace(/^(?:0\.0\.0\.0|\[::\]):/, "127.0.0.1:")}`);
    proxy = createProxy(applicationUrl);
    await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(0, "127.0.0.1", resolve); });
    const url = new URL(`http://127.0.0.1:${proxy.address().port}`);
    await waitFor(new URL("/healthz", url), 200);
    const params = { name: "protected-check", arguments: {} };
    assert.equal((await mcpCall(new URL("/mcp", url), {}, "tools/call", params)).status, 401);
    assert.equal((await mcpCall(new URL("/mcp", url), { authorization: "Bearer restricted" }, "tools/call", params)).status, 403);
    await run("docker", ["stop", "--time", "10", container], project, {}, 30_000);
    assert.match(await run("docker", ["logs", container], project), /HANDLER_CALLS=0/);
  } finally {
    if (proxy) await new Promise((resolve) => proxy.close(resolve));
    await ignoreFailure("docker", ["rm", "--force", container], project);
  }
}

async function withApp(image, target, configPath, check) {
  const container = `${composeProject}-${target.architecture}-app`;
  let proxy;
  try {
    const fixtureArguments = fixture.caPath ? [
      "--add-host", `fixture.example:${fixtureNetworks[key].gateway}`,
      "--mount", `type=bind,source=${fixture.caPath},target=/run/emseepea/fixture-ca.pem,readonly`,
      "-e", "NODE_EXTRA_CA_CERTS=/run/emseepea/fixture-ca.pem",
    ] : ["--add-host", "host.docker.internal:host-gateway"];
    const environment = [
      "-e", "EMSEEPEA_DEPLOYMENT_CONFIG_FILE=/run/emseepea/deployment.json",
      "-e", "EMSEEPEA_RUNTIME_SECRET_CANARY=runtime-only",
      ...(key === "api-backed-server" ? ["-e", `PEA_API_ORIGIN=${fixture.origin}`] : []),
      ...(key === "openapi-backed-server" ? ["-e", `PETSTORE_API_ORIGIN=${fixture.origin}`] : []),
      ...(key === "soap-backed-server" ? ["-e", `PEA_SOAP_URL=${fixture.origin}/soap`] : []),
      ...(key === "mongodb-backed-server" ? ["-e", "MONGODB_URL=mongodb://database:27017"] : []),
      ...(["database-schema-server", "multi-instance-postgres-server"].includes(key)
        ? ["-e", "DATABASE_URL=postgres://emseepea:emseepea@database:5432/emseepea"] : []),
    ];
    await run("docker", [
      "run", "--detach", "--name", container, "--platform", target.platform, "--network", network,
      ...fixtureArguments,
      "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m",
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--publish", `127.0.0.1::${containerPort}`,
      "--mount", `type=bind,source=${configPath},target=/run/emseepea/deployment.json,readonly`,
      ...environment, image,
    ], project);
    const [running] = JSON.parse(await run("docker", ["inspect", container], project));
    assert.equal(running.HostConfig.ReadonlyRootfs, true);
    assert.deepEqual(running.HostConfig.CapDrop, ["ALL"]);
    assert.ok(running.HostConfig.SecurityOpt.includes("no-new-privileges"));
    assert.match(running.HostConfig.Tmpfs["/tmp"], /size=16m/);
    assert.ok(running.Config.Env.includes("EMSEEPEA_RUNTIME_SECRET_CANARY=runtime-only"));
    const published = (await run("docker", ["port", container, `${containerPort}/tcp`], project)).trim();
    const applicationUrl = new URL(`http://${published.replace(/^(?:0\.0\.0\.0|\[::\]):/, "127.0.0.1:")}`);
    proxy = createProxy(applicationUrl);
    await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(0, "127.0.0.1", resolve); });
    const address = proxy.address();
    assert.ok(address && typeof address !== "string");
    const proxyUrl = new URL(`http://127.0.0.1:${address.port}`);
    await waitFor(new URL("/healthz", proxyUrl), 200);
    await check({ applicationUrl, proxyUrl, proxy });
    await run("docker", ["stop", "--time", "10", container], project, {}, 30_000);
    assert.equal(Number((await run("docker", ["inspect", "--format", "{{.State.ExitCode}}", container], project)).trim()), 0);
  } finally {
    if (proxy) await new Promise((resolve) => proxy.close(resolve));
    await ignoreFailure("docker", ["rm", "--force", container], project);
  }
}

async function verifyJourney(url, fixtureRequestsBefore) {
  const journeys = {
    "tool-server": ["tools/call", { name: "get-pea-variety", arguments: { name: "Harbour Gem" } }],
    "api-backed-server": ["tools/call", { name: "search-pea-taxa", arguments: { query: "pea" } }],
    "openapi-backed-server": ["tools/call", { name: "get-pet", arguments: { petId: 7 } }],
    "resources-and-prompts-server": ["resources/read", { uri: "guide://peas/getting-started" }],
    "progress-streaming-server": ["tools/call", { name: "run-germination-trial", arguments: { tray: "sample-tray" } }],
    "html-ui-server": ["tools/call", { name: "preview-planting-plan", arguments: { title: "Container check", peaType: "all", includeTips: false } }],
    "react-ui-server": ["tools/call", { name: "preview-planting-plan", arguments: { title: "Container check", peaType: "all", includeTips: false } }],
    "database-schema-server": ["tools/call", { name: "list-pea-varieties", arguments: {} }],
    "mongodb-backed-server": ["tools/call", { name: "list-pea-varieties", arguments: {} }],
    "multi-instance-postgres-server": ["tools/call", { name: "get-harvest-report", arguments: { gardenBed: "container-check", harvestDate: "2026-09-11" } }],
    "soap-backed-server": ["tools/call", { name: "get-pea-variety", arguments: { name: "Sugar Ann" } }],
  };
  const [method, params] = journeys[key];
  const response = await mcpCall(url, {}, method, params);
  assert.equal(response.status, 200);
  const body = await readRpcBody(response);
  assert.equal(body.error, undefined, JSON.stringify(body));
  if (["api-backed-server", "openapi-backed-server", "soap-backed-server"].includes(key)) {
    assert.ok(fixture.requests > fixtureRequestsBefore, `${key} did not reach its fixture`);
  }
}

async function readRpcBody(response) {
  const text = await response.text();
  if (!response.headers.get("content-type")?.includes("text/event-stream")) return JSON.parse(text);
  const messages = text.split("\n").filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
  return messages.find((message) => message.result || message.error) ?? messages.at(-1);
}

async function startFixture() {
  let requests = 0;
  const secure = key === "api-backed-server" || key === "openapi-backed-server";
  let caPath;
  let tls;
  if (secure) {
    fixtureDirectory = await mkdtemp(path.join(tmpdir(), "emseepea-container-fixture-"));
    const keyPath = path.join(fixtureDirectory, "fixture-key.pem");
    caPath = path.join(fixtureDirectory, "fixture-cert.pem");
    await run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "1",
      "-subj", "/CN=fixture.example", "-addext", "subjectAltName=DNS:fixture.example",
      "-addext", "basicConstraints=critical,CA:TRUE", "-keyout", keyPath, "-out", caPath], fixtureDirectory);
    tls = { key: await readFile(keyPath), cert: await readFile(caPath) };
  }
  const handler = async (request, response) => {
    requests += 1;
    if (request.url?.startsWith("/v1/taxa")) {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ total_results: 1, results: [{
        id: 54522, name: "Pisum sativum", preferred_common_name: "Common Pea",
        rank: "species", observations_count: 8720,
      }] }));
    } else if (request.url === "/api/v3/pet/7") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: 7, name: "Sweet Pea", photoUrls: [], status: "available" }));
    } else if (request.url === "/soap") {
      for await (const _chunk of request) { /* drain request */ }
      response.setHeader("content-type", "text/xml; charset=utf-8");
      response.end('<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pea="urn:emseepea:pea-service"><soap:Body><pea:GetPeaResponse><pea:name>Sugar Ann</pea:name><pea:peaType>snap</pea:peaType><pea:daysToMaturity>56</pea:daysToMaturity><pea:trait>early</pea:trait></pea:GetPeaResponse></soap:Body></soap:Envelope>');
    } else response.writeHead(404).end();
  };
  const server = secure ? createHttpsServer(tls, handler) : createServer(handler);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "0.0.0.0", resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    origin: `${secure ? "https://fixture.example" : "http://host.docker.internal"}:${address.port}`,
    caPath,
    get requests() { return requests; },
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }),
  };
}

function policy(proxyAddress) {
  return `${JSON.stringify({
    allowedAuthorities: ["mcp.example.com"], allowedOrigins: ["https://mcp.example.com"],
    trustedProxyAddresses: [proxyAddress], rateLimit: { maxRequests: 4, windowMs: 60_000, maxClients: 1 },
  })}\n`;
}

async function writePolicy(name, content) {
  const file = path.join(project, `.emseepea-container-${name}.json`);
  files.push(file);
  await writeFile(file, content);
  return file;
}

async function verifyRegistryLock() {
  const manifest = JSON.parse(await readFile(path.join(project, "package.json"), "utf8"));
  const lockfile = JSON.parse(await readFile(path.join(project, "package-lock.json"), "utf8"));
  const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) => name.startsWith("@emseepea/"));
  assert.ok(names.length > 0);
  for (const name of names) assert.match(lockfile.packages[`node_modules/${name}`]?.resolved ?? "", /^https:\/\//,
    `${name} is not resolved from the public registry`);
  return [];
}

async function stageExactPackages() {
  const manifestPath = path.join(project, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const directory = path.join(project, ".emseepea-packages");
  await mkdir(directory);
  const staged = [];
  for (const section of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (!name.startsWith("@emseepea/")) continue;
      const source = tarballs[name];
      assert.ok(source, `missing exact tarball for ${name}`);
      const destination = path.join(directory, path.basename(source));
      await cp(source, destination);
      manifest[section][name] = `file:.emseepea-packages/${path.basename(source)}`;
      staged.push(destination);
    }
  }
  assert.ok(staged.length > 0);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", "--userconfig", "/dev/null"], project, {}, 600_000);
  const lockfile = JSON.parse(await readFile(path.join(project, "package-lock.json"), "utf8"));
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) => name.startsWith("@emseepea/"))) {
    assert.match(lockfile.packages[`node_modules/${name}`]?.resolved ?? "", /^file:\.emseepea-packages\//);
  }
  return staged;
}

function createProxy(applicationUrl) {
  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      if (request.headers.authorization) server.forwardedAuthorization = request.headers.authorization;
      const headers = {
        accept: request.headers.accept ?? "application/json, text/event-stream",
        ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}),
        ...(body.length ? { "content-type": request.headers["content-type"] ?? "application/json", "content-length": body.byteLength } : {}),
        host: request.headers["x-test-authority"] ?? "mcp.example.com",
        ...(request.headers.origin ? { origin: request.headers.origin } : {}),
        ...(request.headers["mcp-method"] ? { "mcp-method": request.headers["mcp-method"] } : {}),
        ...(request.headers["mcp-name"] ? { "mcp-name": request.headers["mcp-name"] } : {}),
        "mcp-protocol-version": request.headers["mcp-protocol-version"] ?? "2026-07-28",
        "x-forwarded-for": request.headers["x-test-client"] ?? "203.0.113.10",
        "x-forwarded-proto": "https",
      };
      const upstream = httpRequest(new URL(request.url, applicationUrl), { method: request.method, headers }, (incoming) => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(response);
      });
      upstream.on("error", (error) => response.writeHead(502).end(String(error)));
      upstream.end(body);
    } catch (error) { response.writeHead(502).end(String(error)); }
  });
  return server;
}

async function mcpCall(url, headers = {}, method = "tools/list", params = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream", "content-type": "application/json",
      "mcp-method": method, ...(params.name ?? params.uri ? { "mcp-name": params.name ?? params.uri } : {}),
      "mcp-protocol-version": "2026-07-28", ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: crypto.randomUUID(), method,
      params: { ...params, _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "container-check", version: "0.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
      } },
    }),
  });
}

async function waitFor(url, expectedStatus) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(url)).status === expectedStatus) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not become ready`);
}

async function run(command, args, cwd, extraEnvironment = {}, timeout = 120_000) {
  const { stdout } = await exec(command, args, {
    cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout,
    env: { ...process.env, ...extraEnvironment },
  });
  return stdout;
}

async function ignoreFailure(command, args, cwd, environment = {}) {
  try { return await run(command, args, cwd, environment, 30_000); } catch { return ""; }
}
