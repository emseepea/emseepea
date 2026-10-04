import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, mock, test } from "node:test";

const state = {
  addresses: [{ address: "8.8.8.8", family: 4 }],
  requests: [],
  response: { status: 200, body: "{}" },
};
const moduleMockExports = Number.parseInt(process.versions.node, 10) < 24 ? "namedExports" : "exports";
mock.module("node:dns/promises", {
  [moduleMockExports]: { lookup: async () => state.addresses },
});
mock.module("node:https", {
  [moduleMockExports]: { request: fakeRequest },
});
const { postCheckedWebhook } = await import("../../packages/framework/dist/events-webhook.js");

beforeEach(() => {
  state.addresses = [{ address: "8.8.8.8", family: 4 }];
  state.requests = [];
  state.response = { status: 200, body: "{}" };
});

test("webhook rejects private DNS answers before egress and pins public TLS connection", async () => {
  state.addresses = [
    { address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 },
  ];
  await assert.rejects(post());
  assert.equal(state.requests.length, 0);

  state.addresses = [{ address: "8.8.8.8", family: 4 }];
  const response = await post();
  assert.equal(response.status, 200);
  assert.equal(state.requests.length, 1);
  const [{ url, options, body }] = state.requests;
  assert.equal(url.href, "https://callback.example.com/events");
  assert.equal(options.agent, false);
  assert.equal(options.autoSelectFamily, false);
  assert.equal(options.servername, "callback.example.com");
  assert.notEqual(options.rejectUnauthorized, false);
  assert.equal(options.headers.Host, "callback.example.com");
  assert.equal(body.toString(), '{"type":"verification"}');
  await new Promise((resolve, reject) => options.lookup("callback.example.com", {}, (error, address) => {
    if (error) reject(error);
    else { assert.equal(address, "8.8.8.8"); resolve(); }
  }));

  state.addresses = [{ address: "127.0.0.1", family: 4 }];
  await assert.rejects(post());
  assert.equal(state.requests.length, 1);
});

test("webhook never follows redirects and rejects oversized responses", async () => {
  state.response = { status: 302, body: "", headers: { location: "https://127.0.0.1/private" } };
  assert.equal((await post()).status, 302);
  assert.equal(state.requests.length, 1);

  state.response = { status: 200, body: "a".repeat(4097) };
  await assert.rejects(post());
  assert.equal(state.requests.length, 2);
});

function post() {
  return postCheckedWebhook("https://callback.example.com/events",
    Buffer.from('{"type":"verification"}'), { "webhook-id": "msg_1" });
}

function fakeRequest(url, options, callback) {
  const record = { url: new URL(url), options, body: undefined };
  state.requests.push(record);
  const outgoing = new EventEmitter();
  outgoing.end = (body) => {
    record.body = body;
    queueMicrotask(() => {
      const incoming = new PassThrough();
      incoming.statusCode = state.response.status;
      incoming.headers = state.response.headers ?? {};
      callback(incoming);
      if (incoming.destroyed) return;
      incoming.end(state.response.body);
    });
  };
  return outgoing;
}
