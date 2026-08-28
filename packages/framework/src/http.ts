import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { RequestOptions } from "node:https";
import { BlockList, isIP } from "node:net";
import { TextDecoder } from "node:util";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_RESPONSE_HEADER_BYTES = 16 * 1024;
const MAX_REQUEST_TARGET_BYTES = 8 * 1024;
const MAX_DEADLINE_DELAY_MS = 2_147_483_647;
const FAILURE_MESSAGE = "Outbound JSON request failed";

const prohibitedIpv4Addresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) prohibitedIpv4Addresses.addSubnet(network, prefix, "ipv4");
const prohibitedIpv6Addresses = new BlockList();
const globallyRoutableIpv6Addresses = new BlockList();
globallyRoutableIpv6Addresses.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) prohibitedIpv6Addresses.addSubnet(network, prefix, "ipv6");

export interface JsonHttpClientOptions {
  readonly origin: string | URL;
  readonly maxResponseBytes?: number;
}

export interface JsonHttpGetOptions {
  readonly pathname: string;
  readonly searchParams?: Readonly<Record<string, string | readonly string[]>>;
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
}

export interface JsonHttpClient {
  readonly get: (options: JsonHttpGetOptions) => Promise<unknown>;
}

export function createJsonHttpClient(candidate: JsonHttpClientOptions): JsonHttpClient {
  assertKeys(candidate, ["origin", "maxResponseBytes"], "HTTP client options");
  const origin = normalizeOrigin(candidate.origin);
  const maxResponseBytes = boundedPositiveInteger(
    candidate.maxResponseBytes ?? MAX_RESPONSE_BYTES,
    "maxResponseBytes",
    MAX_RESPONSE_BYTES,
  );

  return Object.freeze({
    async get(options: JsonHttpGetOptions): Promise<unknown> {
      try {
        assertKeys(options, ["pathname", "searchParams", "signal", "deadlineMs"], "HTTP GET options");
        const url = requestUrl(origin, options.pathname, options.searchParams);
        const operation = operationSignal(options.signal, options.deadlineMs);
        try {
          operation.signal.throwIfAborted();
          const addresses = await waitFor(lookup(url.hostname, { all: true, order: "verbatim" }), operation.signal);
          operation.signal.throwIfAborted();
          if (addresses.length === 0 || addresses.some(({ address, family }) => !isAllowedAddress(address, family))) {
            throw new Error(FAILURE_MESSAGE);
          }
          const selected = addresses[0];
          if (!selected) throw new Error(FAILURE_MESSAGE);
          return await waitFor(readJson(url, selected, maxResponseBytes, operation.signal), operation.signal);
        } finally {
          operation.dispose();
        }
      } catch {
        throw new Error(FAILURE_MESSAGE);
      }
    },
  });
}

function normalizeOrigin(candidate: string | URL): URL {
  let url: URL;
  try {
    url = new URL(candidate instanceof URL ? candidate.href : candidate);
  } catch {
    throw new TypeError("origin must be a valid URL");
  }
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash || isIP(hostname) !== 0) {
    throw new TypeError("origin must be an HTTPS origin without credentials, path, query, fragment, or IP literal");
  }
  return new URL(url.origin);
}

function requestUrl(
  origin: URL,
  pathname: string,
  searchParams: Readonly<Record<string, string | readonly string[]>> | undefined,
): URL {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//") ||
      pathname.includes("\\") || pathname.includes("?") || pathname.includes("#")) {
    throw new TypeError("pathname must be one root-relative URL path");
  }
  const url = new URL(pathname, origin);
  if (url.origin !== origin.origin || url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new TypeError("pathname escaped the configured origin");
  }
  if (searchParams !== undefined) {
    assertPlainRecord(searchParams, "searchParams");
    for (const [name, value] of Object.entries(searchParams).sort(([left], [right]) => left.localeCompare(right))) {
      if (typeof value === "string") {
        url.searchParams.append(name, value);
      } else if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
        for (const entry of value) url.searchParams.append(name, entry);
      } else {
        throw new TypeError("searchParams values must be strings or string arrays");
      }
    }
  }
  if (Buffer.byteLength(`${url.pathname}${url.search}`, "utf8") > MAX_REQUEST_TARGET_BYTES) {
    throw new TypeError("request target exceeds the configured size limit");
  }
  return url;
}

function isAllowedAddress(address: string, family: number): boolean {
  if (isIP(address) !== family || (family !== 4 && family !== 6)) return false;
  return family === 4
    ? !prohibitedIpv4Addresses.check(address, "ipv4")
    : globallyRoutableIpv6Addresses.check(address, "ipv6")
      && !prohibitedIpv6Addresses.check(address, "ipv6");
}

function operationSignal(parent: AbortSignal, deadlineMs: number): {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
} {
  if (!(parent instanceof AbortSignal) || !Number.isSafeInteger(deadlineMs) ||
      deadlineMs - Date.now() > MAX_DEADLINE_DELAY_MS) {
    throw new TypeError("signal and a safe-integer absolute deadlineMs are required");
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent.aborted || deadlineMs <= Date.now()) controller.abort();
  else parent.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, Math.max(0, deadlineMs - Date.now()));
  timer.unref();
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parent.removeEventListener("abort", abort);
    },
  };
}

async function waitFor<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new Error(FAILURE_MESSAGE);
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => finish(() => reject(new Error(FAILURE_MESSAGE)));
    signal.addEventListener("abort", abort, { once: true });
    void promise.then(
      (value) => finish(() => resolve(value)),
      () => finish(() => reject(new Error(FAILURE_MESSAGE))),
    );
  });
}

function readJson(
  url: URL,
  selected: { readonly address: string; readonly family: number },
  maxResponseBytes: number,
  signal: AbortSignal,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error(FAILURE_MESSAGE));
    };
    const requestOptions = {
      agent: false,
      autoSelectFamily: false,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        Host: url.host,
      },
      family: selected.family,
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
      maxHeaderSize: MAX_RESPONSE_HEADER_BYTES,
      method: "GET",
      servername: url.hostname,
      signal,
    } satisfies RequestOptions & { readonly autoSelectFamily: false };
    const outgoing = request(url, requestOptions, (incoming) => {
      if (signal.aborted || settled) {
        incoming.destroy();
        return;
      }
      const status = incoming.statusCode ?? 0;
      const contentType = oneHeader(incoming.headersDistinct?.["content-type"]);
      const contentEncoding = oneHeader(incoming.headersDistinct?.["content-encoding"]);
      const contentLength = oneHeader(incoming.headersDistinct?.["content-length"]);
      if (status < 200 || status > 299 || !isJsonContentType(contentType ?? undefined) ||
          contentEncoding === null ||
          (contentEncoding !== undefined && contentEncoding.toLowerCase() !== "identity") ||
          contentLength === null ||
          (contentLength !== undefined && !validContentLength(contentLength, maxResponseBytes))) {
        incoming.destroy();
        fail();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      incoming.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxResponseBytes) {
          incoming.destroy();
          fail();
        } else {
          chunks.push(buffer);
        }
      });
      incoming.once("aborted", fail);
      incoming.once("error", fail);
      incoming.once("close", () => {
        if (!incoming.complete) fail();
      });
      incoming.once("end", () => {
        if (settled) return;
        try {
          signal.throwIfAborted();
          const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
          const value: unknown = JSON.parse(text);
          signal.throwIfAborted();
          settled = true;
          resolve(value);
        } catch {
          fail();
        }
      });
    });
    outgoing.once("error", fail);
    outgoing.end();
  });
}

function oneHeader(values: readonly string[] | undefined): string | undefined | null {
  if (values === undefined || values.length === 0) return undefined;
  return values.length === 1 ? values[0] ?? null : null;
}

function isJsonContentType(value: string | undefined): boolean {
  return value !== undefined && /^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;.*)?$/i.test(value);
}

function validContentLength(value: string, maximum: number): boolean {
  const length = Number(value);
  return /^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(length) && length <= maximum;
}

function assertKeys(value: unknown, allowed: readonly string[], label: string): asserts value is Record<string, unknown> {
  assertPlainRecord(value, label);
  const accepted = new Set(allowed);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !accepted.has(key))) {
    throw new TypeError(`${label} contains an unsupported field`);
  }
}

function assertPlainRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function boundedPositiveInteger(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${label} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}
