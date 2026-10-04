import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDemoAuth } from "./auth.mjs";
import { openStore } from "./store.mjs";

test("subscriptions survive restart and leases reject stale workers", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "emseepea-events-smoke-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "events.sqlite");
  const first = openStore(path);
  await first.subscription.put({ id: "sub-1", name: "note.created", ownerKey: "account", arguments: { inbox_id: "demo" },
    url: "https://example.com/callback", secret: "whsec_test", expiresAt: Date.now() + 60_000 });
  await first.subscription.enqueue({ id: "job-1", subscriptionId: "sub-1", eventId: "event-1", body: "{}", attempts: 0, nextAttemptAt: 1 });
  const initial = await first.subscription.claimDue(1, 100, 50);
  assert.equal(initial.length, 1);
  assert.deepEqual(await first.subscription.claimDue(1, 149, 50), []);
  first.close();

  const second = openStore(path);
  assert.equal((await second.subscription.list("note.created")).length, 1);
  const recovered = await second.subscription.claimDue(1, 150, 50);
  assert.equal(recovered.length, 1);
  await second.subscription.complete("job-1", initial[0].leaseId);
  assert.deepEqual(await second.subscription.claimDue(1, 151, 50), []);
  await second.subscription.complete("job-1", recovered[0].leaseId);
  assert.deepEqual(await second.subscription.claimDue(1, 300, 50), []);
  assert.equal(second.healthy(), true);
  second.close();
});

test("ChatGPT-style DCR, PIN, PKCE, resource binding and bearer verification", async (t) => {
  const issuer = "https://auth.example.test";
  const resource = "https://mcp.example.test/mcp";
  const pin = "smoke-only-test-pin";
  const auth = createDemoAuth({ issuer, resource, pin, signingKey: randomBytes(32) });
  await new Promise((resolve) => auth.server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => auth.server.close(resolve)));
  const base = `http://127.0.0.1:${auth.server.address().port}`;
  const metadata = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
  assert.equal(metadata.code_challenge_methods_supported[0], "S256");
  const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
  const registration = await fetch(`${base}/register`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: [redirectUri] }) });
  assert.equal(registration.status, 201);
  const { client_id: clientId } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    code_challenge: challenge, code_challenge_method: "S256", resource, scope: "notes:read events:read", state: "state-1" });
  const page = await fetch(`${base}/authorize?${params}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Temporary test PIN/);
  const denied = await fetch(`${base}/authorize`, { method: "POST", body: new URLSearchParams({ ...Object.fromEntries(params), pin: "wrong" }) });
  assert.equal(denied.status, 401);
  const deniedPage = await denied.text();
  assert.match(deniedPage, /role="alert">Incorrect PIN/);
  assert.match(deniedPage, /aria-invalid="true" aria-describedby="pin-error"/);
  assert.match(deniedPage, /name="state" value="state-1"/);
  const consent = await fetch(`${base}/authorize`, { method: "POST", redirect: "manual",
    body: new URLSearchParams({ ...Object.fromEntries(params), pin }) });
  assert.equal(consent.status, 302);
  const callback = new URL(consent.headers.get("location"));
  assert.equal(callback.origin, "https://chatgpt.com");
  assert.equal(callback.searchParams.get("iss"), issuer);
  assert.equal(callback.searchParams.get("state"), "state-1");
  const token = await fetch(`${base}/token`, { method: "POST", body: new URLSearchParams({
    grant_type: "authorization_code", code: callback.searchParams.get("code"), code_verifier: verifier,
    client_id: clientId, redirect_uri: redirectUri, resource,
  }) });
  assert.equal(token.status, 200);
  const { access_token: accessToken } = await token.json();
  const verified = auth.verifyAccessToken(accessToken);
  assert.equal(verified.resource.href, resource);
  assert.deepEqual(verified.scopes, ["notes:read", "events:read"]);
  assert.throws(() => auth.verifyAccessToken(`${accessToken}x`), /Invalid token/);
});
