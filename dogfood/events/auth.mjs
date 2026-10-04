import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const b64 = (value) => Buffer.from(value).toString("base64url");
const digest = (value) => createHash("sha256").update(value).digest("base64url");
const equal = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const allowedRedirect = (value) => {
  try {
    const url = new URL(value);
    return url.origin === "https://chatgpt.com" &&
      (url.pathname.startsWith("/connector/oauth/") || url.pathname === "/connector_platform_oauth_redirect");
  } catch { return false; }
};

export function createDemoAuth({ issuer, resource, pin, signingKey }) {
  const clients = new Map();
  const codes = new Map();
  const attempts = new Map();
  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["notes:read", "events:read"],
    authorization_response_iss_parameter_supported: true,
  };
  const server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(400, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ error: "invalid_request" }));
    });
  });
  async function handle(request, response) {
    const url = new URL(request.url, issuer);
    const json = (status, data) => {
      response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(data));
    };
    const signInForm = (params, status = 200, error = "") => {
      response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; form-action 'self'" });
      const hidden = [...params].filter(([name]) => name !== "pin").map(([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("");
      response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Events smoke-test sign in</title></head><body><main><h1>Events smoke-test sign in</h1><p>Authorize access only to synthetic demo notes.</p><form method="post" action="/authorize">${error ? `<p id="pin-error" role="alert">${error}</p>` : ""}<label for="pin">Temporary test PIN</label><input id="pin" name="pin" type="password" autocomplete="one-time-code" required${error ? ' aria-invalid="true" aria-describedby="pin-error"' : ""}><button>Authorize demo access</button>${hidden}</form></main></body></html>`);
    };
    if (request.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
      return json(200, metadata);
    }
    if (request.method === "POST" && url.pathname === "/register") {
      let body;
      try { body = JSON.parse(await readBody(request)); } catch { return json(400, { error: "invalid_client_metadata" }); }
      if (clients.size >= 32) return json(429, { error: "registration_limit" });
      if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length < 1 ||
          body.redirect_uris.some((uri) => !allowedRedirect(uri))) {
        return json(400, { error: "invalid_redirect_uri" });
      }
      const clientId = randomUUID();
      clients.set(clientId, new Set(body.redirect_uris));
      return json(201, { client_id: clientId, redirect_uris: body.redirect_uris,
        token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] });
    }
    if (url.pathname === "/authorize" && (request.method === "GET" || request.method === "POST")) {
      const params = request.method === "GET" ? url.searchParams : new URLSearchParams(await readBody(request));
      const clientId = params.get("client_id");
      const redirectUri = params.get("redirect_uri");
      const challenge = params.get("code_challenge");
      const scope = params.get("scope") ?? "";
      if (params.get("response_type") !== "code" || !clients.get(clientId)?.has(redirectUri) ||
          params.get("resource") !== resource || params.get("code_challenge_method") !== "S256" ||
          !/^[A-Za-z0-9_-]{43,128}$/.test(challenge ?? "") ||
          scope.split(" ").some((part) => part && !metadata.scopes_supported.includes(part))) {
        return json(400, { error: "invalid_request" });
      }
      if (request.method === "GET") {
        return signInForm(params);
      }
      const ip = request.socket.remoteAddress ?? "unknown";
      const attempt = attempts.get(ip) ?? { count: 0, until: Date.now() + 60_000 };
      if (Date.now() > attempt.until) { attempt.count = 0; attempt.until = Date.now() + 60_000; }
      attempt.count++;
      attempts.set(ip, attempt);
      if (attempt.count > 5) return signInForm(params, 429, "Too many attempts. Wait one minute and try again.");
      if (!equal(params.get("pin") ?? "", pin)) return signInForm(params, 401, "Incorrect PIN. Check the temporary test PIN and try again.");
      for (const [value, entry] of codes) if (entry.expiresAt < Date.now()) codes.delete(value);
      if (codes.size >= 32) return json(429, { error: "authorization_limit" });
      const code = randomBytes(32).toString("base64url");
      codes.set(code, { clientId, redirectUri, challenge, scope, resource, expiresAt: Date.now() + 120_000 });
      const target = new URL(redirectUri);
      target.searchParams.set("code", code);
      target.searchParams.set("iss", issuer);
      if (params.has("state")) target.searchParams.set("state", params.get("state"));
      response.writeHead(302, { location: target.href, "cache-control": "no-store" });
      response.end();
      return;
    }
    if (request.method === "POST" && url.pathname === "/token") {
      const params = new URLSearchParams(await readBody(request));
      const code = params.get("code");
      const grant = codes.get(code);
      codes.delete(code);
      if (params.get("grant_type") !== "authorization_code" || !grant || grant.expiresAt < Date.now() ||
          params.get("client_id") !== grant.clientId || params.get("redirect_uri") !== grant.redirectUri ||
          params.get("resource") !== grant.resource || digest(params.get("code_verifier") ?? "") !== grant.challenge) {
        return json(400, { error: "invalid_grant" });
      }
      const payload = b64(JSON.stringify({ sub: "synthetic-test-account", aud: resource,
        clientId: grant.clientId, scope: grant.scope, exp: Math.floor(Date.now() / 1000) + 3600 }));
      const signature = createHmac("sha256", signingKey).update(payload).digest("base64url");
      return json(200, { access_token: `${payload}.${signature}`, token_type: "Bearer",
        expires_in: 3600, scope: grant.scope });
    }
    json(404, { error: "not_found" });
  }
  return {
    metadata,
    server,
    verifyAccessToken(token) {
      const [payload, signature] = token.split(".");
      if (!payload || !signature || !equal(createHmac("sha256", signingKey).update(payload).digest("base64url"), signature)) {
        throw new Error("Invalid token");
      }
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (claims.aud !== resource || claims.exp <= Date.now() / 1000 || claims.sub !== "synthetic-test-account") {
        throw new Error("Invalid token claims");
      }
      return { token, clientId: claims.clientId, scopes: claims.scope.split(" ").filter(Boolean),
        expiresAt: claims.exp, resource: new URL(resource) };
    },
  };
}

async function readBody(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 8192) throw new Error("Request body too large");
  }
  return text;
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
