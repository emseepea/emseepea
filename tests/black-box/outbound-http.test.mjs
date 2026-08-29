import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { beforeEach, mock, test } from "node:test";

const state = {
  addresses: [{ address: "8.8.8.8", family: 4 }],
  lookup: undefined,
  lookups: [],
  requests: [],
  response: undefined,
};

const moduleMockExports = Number.parseInt(process.versions.node, 10) < 24 ? "namedExports" : "exports";

mock.module("node:dns/promises", {
  [moduleMockExports]: {
    lookup: async (hostname, options) => state.lookup
      ? (state.lookups.push({ hostname, options }), await state.lookup(hostname, options))
      : (state.lookups.push({ hostname, options }), state.addresses),
  },
});
mock.module("node:https", { [moduleMockExports]: { request: fakeRequest } });

const { createJsonHttpClient } = await import(
  process.env.EMSEEPEA_HTTP_TEST_MODULE ?? "@emseepea/server/http"
);

beforeEach(() => {
  state.addresses = [{ address: "8.8.8.8", family: 4 }];
  state.lookup = undefined;
  state.lookups = [];
  state.requests = [];
  state.response = undefined;
});

test("the HTTP client is exposed only through its public package subpath", async () => {
  const packageJson = JSON.parse(await readFile(
    new URL("../../packages/framework/package.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(packageJson.exports["./http"], {
    types: "./dist/http.d.ts",
    import: "./dist/http.js",
  });
});

test("the client accepts only one bounded HTTPS origin", () => {
  for (const origin of [
    "http://api.example",
    "https://user:secret@api.example",
    "https://api.example/path",
    "https://api.example?secret=yes",
    "https://api.example#fragment",
    "https://127.0.0.1",
    "https://[::1]",
  ]) {
    assert.throws(() => createJsonHttpClient({ origin }));
  }
  assert.throws(() => createJsonHttpClient({ origin: "https://api.example", extra: true }));
  assert.throws(() => createJsonHttpClient({ origin: "https://api.example", maxResponseBytes: 0 }));
  assert.throws(() => createJsonHttpClient({ origin: "https://api.example", maxResponseBytes: 1_048_577 }));
  assert.doesNotThrow(() => createJsonHttpClient({
    origin: "https://api.example",
    maxResponseBytes: 1_048_576,
  }));
});

test("all DNS answers must be public and well formed", async () => {
  const prohibited = [
    { address: "0.0.0.0", family: 4 },
    { address: "10.0.0.1", family: 4 },
    { address: "100.64.0.1", family: 4 },
    { address: "127.0.0.1", family: 4 },
    { address: "169.254.169.254", family: 4 },
    { address: "172.31.255.255", family: 4 },
    { address: "192.168.1.1", family: 4 },
    { address: "198.18.0.1", family: 4 },
    { address: "224.0.0.1", family: 4 },
    { address: "::", family: 6 },
    { address: "::1", family: 6 },
    { address: "::ffff:8.8.8.8", family: 6 },
    { address: "fc00::1", family: 6 },
    { address: "fe80::1", family: 6 },
    { address: "ff00::1", family: 6 },
    { address: "100:0:0:1::1", family: 6 },
    { address: "5f00::1", family: 6 },
    { address: "4000::1", family: 6 },
    { address: "8.8.8.8", family: 6 },
  ];
  for (const address of prohibited) {
    state.addresses = [address];
    await assert.rejects(get());
  }
  state.addresses = [];
  await assert.rejects(get());
  state.addresses = [
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ];
  await assert.rejects(get());
  assert.equal(state.requests.length, 0);
});

test("adjacent public address ranges remain usable", async () => {
  for (const address of [
    { address: "9.255.255.255", family: 4 },
    { address: "11.0.0.0", family: 4 },
    { address: "126.255.255.255", family: 4 },
    { address: "128.0.0.0", family: 4 },
    { address: "169.253.255.255", family: 4 },
    { address: "169.255.0.0", family: 4 },
    { address: "172.15.255.255", family: 4 },
    { address: "172.32.0.0", family: 4 },
    { address: "192.167.255.255", family: 4 },
    { address: "192.169.0.0", family: 4 },
    { address: "223.255.255.255", family: 4 },
    { address: "2001:4860:4860::8888", family: 6 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]) {
    state.addresses = [address];
    assert.deepEqual(await get(), { ok: true });
  }
  assert.equal(state.requests.length, 13);
});

test("each call resolves again and pins one validated address", async () => {
  let attempt = 0;
  state.lookup = async (_hostname, options) => {
    assert.deepEqual(options, { all: true, order: "verbatim" });
    attempt += 1;
    return attempt === 1
      ? [{ address: "8.8.8.8", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  };
  assert.deepEqual(await get(), { ok: true });
  await assert.rejects(get());
  assert.equal(state.requests.length, 1);
  const [{ url, options }] = state.requests;
  assert.equal(url.href, "https://api.example/report?a=first&a=second&q=coffee");
  assert.equal(options.agent, false);
  assert.equal(options.autoSelectFamily, false);
  assert.equal(options.family, 4);
  assert.equal(options.maxHeaderSize, 16_384);
  assert.equal(options.servername, "api.example");
  assert.equal(options.headers.Host, "api.example");
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.headers.Cookie, undefined);
  assert.equal(options.headers["Accept-Encoding"], "identity");
  await new Promise((resolve, reject) => options.lookup("api.example", {}, (error, address, family) => {
    if (error) reject(error);
    else {
      assert.equal(address, "8.8.8.8");
      assert.equal(family, 4);
      resolve();
    }
  }));
});

test("request paths and search values cannot escape the configured origin", async () => {
  for (const pathname of [
    "https://attacker.example/report",
    "//attacker.example/report",
    "/\\attacker.example/report",
    "/report?secret=yes",
    "/report#secret",
  ]) {
    await assert.rejects(get({ pathname }));
  }
  await assert.rejects(get({ searchParams: { q: 7 } }));
  await assert.rejects(get({ unknown: true }));
  assert.deepEqual(await get({ pathname: `/${"x".repeat(8_191)}`, searchParams: {} }), { ok: true });
  await assert.rejects(get({ pathname: `/${"x".repeat(8_192)}` }));
  assert.equal(state.requests.length, 1);
});

test("redirects, status, headers, encoding, and declared sizes fail before reading", async () => {
  for (const response of [
    { statusCode: 302 },
    { statusCode: 500 },
    { headers: { "content-type": ["text/plain"] } },
    { headers: { "content-type": ["application/json", "application/problem+json"] } },
    { headers: { "content-encoding": ["gzip"] } },
    { headers: { "content-encoding": ["identity", "identity"] } },
    { headers: { "content-length": ["999"] }, maxResponseBytes: 8 },
    { headers: { "content-length": ["1", "1"] } },
    { headers: { "content-length": ["not-a-number"] } },
  ]) {
    state.response = response;
    await assert.rejects(get({}, response.maxResponseBytes));
    assert.equal(response.destroyed, true);
  }
  assert.equal(state.requests.length, 9);
});

test("streamed bodies, empty bodies, malformed JSON, and invalid UTF-8 are rejected", async () => {
  for (const response of [
    { chunks: ["12345", "67890"] },
    { chunks: [] },
    { chunks: ["{"] },
    { chunks: [Buffer.from([0xc3, 0x28])] },
    { chunks: [], close: true },
  ]) {
    state.response = response;
    await assert.rejects(get({}, response === state.response && response.chunks.length === 2 ? 8 : undefined));
  }
});

test("JSON and structured JSON media types succeed", async () => {
  for (const contentType of ["application/json", "application/json; charset=utf-8", "application/problem+json"]) {
    state.response = { headers: { "content-type": [contentType] }, chunks: ["{\"answer\":42}"] };
    assert.deepEqual(await get(), { answer: 42 });
  }
});

test("cancellation and deadlines abandon DNS without starting a request", async () => {
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  await assert.rejects(get({ signal: alreadyCancelled.signal }));
  await assert.rejects(get({
    signal: new AbortController().signal,
    deadlineMs: Date.now() - 1,
  }));
  assert.equal(state.lookups.length, 0);

  let finishLookup;
  state.lookup = () => new Promise((resolve) => { finishLookup = resolve; });
  const controller = new AbortController();
  const cancelled = get({ signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled);
  finishLookup([{ address: "8.8.8.8", family: 4 }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.requests.length, 0);

  const signal = new AbortController().signal;
  await withActiveIo(assert.rejects(get({ signal, deadlineMs: Date.now() + 5 })));
  await assert.rejects(get({ signal, deadlineMs: Date.now() + 2_147_483_648 + 60_000 }));
  assert.equal(state.requests.length, 0);
});

test("cancellation while waiting for the response destroys the request", async () => {
  state.response = { chunks: ["{\"partial\":"], firstChunkThenHold: true };
  const controller = new AbortController();
  const pending = get({ signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending);
  assert.equal(state.requests[0].destroyed, true);

  state.response = { hold: true };
  await withActiveIo(assert.rejects(get({
    signal: new AbortController().signal,
    deadlineMs: Date.now() + 5,
  })));
  assert.equal(state.requests[1].destroyed, true);
});

test("all network failures are information safe", async () => {
  state.response = {
    error: "secret-native-error",
    headers: { "x-secret": ["secret-header"] },
    chunks: ["secret-body"],
  };
  const error = await get().then(
    () => assert.fail("request unexpectedly succeeded"),
    (failure) => failure,
  );
  assert.equal(error.message, "Outbound JSON request failed");
  const serialized = `${error.name}\n${error.message}\n${JSON.stringify(error)}`;
  for (const secret of ["secret-native-error", "secret-header", "secret-body", "api.example"]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

function get(overrides = {}, maxResponseBytes) {
  const client = createJsonHttpClient({
    origin: "https://api.example",
    ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
  });
  return client.get({
    pathname: "/report",
    searchParams: { q: "coffee", a: ["first", "second"] },
    signal: AbortSignal.timeout(1_000),
    deadlineMs: Date.now() + 1_000,
    ...overrides,
  });
}

function withActiveIo(promise) {
  const keepAlive = setTimeout(() => {}, 1_000);
  return promise.finally(() => clearTimeout(keepAlive));
}

function fakeRequest(url, options, callback) {
  const record = { url: new URL(url), options, destroyed: false };
  state.requests.push(record);
  const outgoing = new EventEmitter();
  outgoing.destroy = () => { record.destroyed = true; };
  options.signal.addEventListener("abort", () => {
    outgoing.destroy();
    outgoing.emit("error", new Error("secret abort detail"));
  }, { once: true });
  outgoing.end = () => {
    queueMicrotask(() => {
      if (record.destroyed) return;
      const plan = state.response ?? {};
      if (plan.error) {
        outgoing.emit("error", new Error(plan.error));
        return;
      }
      const body = plan.chunks ?? ["{\"ok\":true}"];
      const incoming = new PassThrough();
      incoming.complete = false;
      incoming.statusCode = plan.statusCode ?? 200;
      incoming.headersDistinct = {
        "content-type": ["application/json"],
        ...(body.length ? { "content-length": [String(body.reduce((bytes, chunk) => bytes + Buffer.byteLength(chunk), 0))] } : {}),
        ...plan.headers,
      };
      const destroy = incoming.destroy.bind(incoming);
      incoming.destroy = (...args) => {
        plan.destroyed = true;
        return destroy(...args);
      };
      callback(incoming);
      if (plan.hold || incoming.destroyed) return;
      if (plan.close) {
        incoming.destroy();
        return;
      }
      for (const chunk of body) incoming.write(chunk);
      if (plan.firstChunkThenHold) return;
      incoming.complete = true;
      incoming.end();
    });
  };
  return outgoing;
}
