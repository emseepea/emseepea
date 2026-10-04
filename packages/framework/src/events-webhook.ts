import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { RequestOptions } from "node:https";
import { isIP } from "node:net";
import { isAllowedAddress } from "./http.js";

const MAX_RESPONSE_BYTES = 4096;
const MAX_HEADER_BYTES = 8192;

export interface WebhookResponse {
  readonly status: number;
  readonly body: Buffer;
}

export function signWebhook(secret: string, id: string, timestamp: number, body: Buffer): string {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.`).update(body).digest("base64")}`;
}

/** Resolve on every request and pin the validated address for the TLS connection. */
export async function postCheckedWebhook(
  url: string,
  body: Buffer,
  headers: Readonly<Record<string, string>>,
): Promise<WebhookResponse> {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.username || target.password || target.hash ||
      isIP(target.hostname.replace(/^\[|\]$/g, "")) !== 0 ||
      target.hostname === "localhost" || target.hostname.endsWith(".localhost") ||
      target.hostname.endsWith(".local") ||
      (target.port && target.port !== "443") || Buffer.byteLength(`${target.pathname}${target.search}`) > 8192) {
    throw new Error("unsafe_callback");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  timeout.unref();
  try {
    const addresses = await Promise.race([
      lookup(target.hostname, { all: true, order: "verbatim" }),
      new Promise<never>((_resolve, reject) =>
        controller.signal.addEventListener("abort", () => reject(new Error("callback_timeout")), { once: true })),
    ]);
    if (addresses.length === 0 || addresses.some(({ address, family }) => !isAllowedAddress(address, family))) {
      throw new Error("unsafe_callback");
    }
    const address = addresses[0]!;
    return await new Promise<WebhookResponse>((resolve, reject) => {
      const requestOptions = {
        agent: false,
        autoSelectFamily: false,
        family: address.family,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        servername: target.hostname,
        method: "POST",
        maxHeaderSize: MAX_HEADER_BYTES,
        signal: controller.signal,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": String(body.byteLength),
          Host: target.host,
          "Accept-Encoding": "identity",
        },
      } satisfies RequestOptions & { readonly autoSelectFamily: false };
      const outgoing = request(target, requestOptions, (incoming) => {
        const contentLength = incoming.headers["content-length"];
        if (Number(contentLength) > MAX_RESPONSE_BYTES || incoming.headers["content-encoding"] ||
            Number(incoming.headers["content-length"]) < 0) {
          incoming.destroy();
          reject(new Error("invalid_callback_response"));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        incoming.on("data", (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) {
            incoming.destroy();
            reject(new Error("invalid_callback_response"));
          } else chunks.push(chunk);
        });
        incoming.once("error", reject);
        incoming.once("aborted", () => reject(new Error("invalid_callback_response")));
        incoming.once("end", () => resolve({ status: incoming.statusCode ?? 0, body: Buffer.concat(chunks) }));
      });
      outgoing.once("error", reject);
      outgoing.end(body);
    });
  } finally {
    clearTimeout(timeout);
  }
}
