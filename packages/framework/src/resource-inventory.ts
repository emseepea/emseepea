import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ProtocolError, ProtocolErrorCode, type ListResourcesResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { OperationContext, Principal } from "./index.js";

export interface ResourceInventoryEntry {
  /** Unique immutable ASCII ordering key, including any tie-breaker. */
  readonly key: string;
  readonly resource: { readonly uri: string; readonly name: string; readonly mimeType: string };
}
export interface ResourceInventoryPage {
  readonly entries: readonly ResourceInventoryEntry[];
  readonly hasMore: boolean;
}
export type ResourceInventoryHandler = (
  input: { readonly after?: string; readonly limit: number },
  context: OperationContext & { readonly principal: Principal },
) => ResourceInventoryPage | Promise<ResourceInventoryPage>;
export interface InventorySource {
  readonly name: string;
  readonly uriTemplate: string;
  readonly requiredScopes: readonly string[];
  readonly matches: (uri: string) => boolean;
  readonly list: ResourceInventoryHandler;
}
export class ResourceInventoryCursorError extends ProtocolError {
  constructor() { super(ProtocolErrorCode.InvalidParams, "Invalid pagination cursor; restart listing"); }
}
const lifetimeMs = 15 * 60 * 1000;
const positionSchema = z.strictObject({
  source: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  after: z.string().regex(/^[\x21-\x7e]{1,256}$/).optional(),
  expires: z.number().int().positive(),
});
type Position = z.infer<typeof positionSchema>;
const pageSchema = z.strictObject({
  entries: z.array(z.strictObject({
    key: z.string().regex(/^[\x21-\x7e]{1,256}$/),
    resource: z.strictObject({
      uri: z.string().min(1).max(2048),
      name: z.string().trim().min(1).max(512),
      // oxlint-disable-next-line no-control-regex -- MIME metadata must not contain control characters.
      mimeType: z.string().min(1).max(128).regex(/^[^\r\n\x00]+\/[^\r\n\x00]+$/),
    }),
  })).max(100),
  hasMore: z.boolean(),
});

/** Process-local encrypted cursors; no retained pages, snapshots, or cursor table. */
export function createResourceInventory(options: {
  readonly sources: readonly InventorySource[];
  readonly catalogue: unknown;
  readonly serverInfo: unknown;
  readonly pageSize: number;
  readonly maxPageBytes: number;
  readonly maxBackendBytes: number;
}) {
  if (Buffer.byteLength(JSON.stringify({ resources: [], resultType: "complete", ttlMs: 0,
    cacheScope: "private", _meta: { "io.modelcontextprotocol/serverInfo": options.serverInfo } })) > options.maxPageBytes)
    throw new TypeError("Resource inventory page bounds cannot fit an empty response");
  const key = randomBytes(32);
  const catalogue = createHash("sha256").update(JSON.stringify([
    options.catalogue, options.sources.map(({ name, uriTemplate, requiredScopes }) =>
      [name, uriTemplate, requiredScopes]), options.pageSize, options.maxPageBytes,
  ])).digest("hex");
  function binding(principal: Principal): Buffer {
    return createHash("sha256").update(JSON.stringify([
      catalogue, principal.clientId, principal.subject ?? null, principal.resource ?? null,
      [...principal.permissions].sort(),
    ])).digest();
  }
  function encode(position: Position, aad: Buffer): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(position), "utf8"), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
  }
  function decode(cursor: string, aad: Buffer, sources: number): Position {
    try {
      if (!/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) throw new Error();
      const bytes = Buffer.from(cursor, "base64url");
      if (bytes.toString("base64url") !== cursor || bytes.length < 29) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
      decipher.setAAD(aad);
      decipher.setAuthTag(bytes.subarray(12, 28));
      const position = positionSchema.parse(JSON.parse(Buffer.concat([
        decipher.update(bytes.subarray(28)), decipher.final(),
      ]).toString("utf8")));
      if (position.expires <= Date.now() || position.expires > Date.now() + lifetimeMs ||
          position.source >= sources || position.source === 0 && position.after !== undefined ||
          position.source > 0 && position.offset !== 0) throw new Error();
      return position;
    } catch {
      throw new ResourceInventoryCursorError();
    }
  }
  return async (
    cursor: string | undefined,
    staticEntries: readonly Readonly<Record<string, unknown>>[],
    context: OperationContext & { readonly principal: Principal },
  ): Promise<ListResourcesResult> => {
    const sources = options.sources.filter((source) =>
      source.requiredScopes.every((scope) => context.principal.permissions.includes(scope)));
    if (sources.length === 0) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Resource inventory unavailable");
    const aad = binding(context.principal);
    let position: Position = cursor === undefined
      ? { source: 0, offset: 0, expires: Date.now() + lifetimeMs }
      : decode(cursor, aad, sources.length + 1);
    const resources: ListResourcesResult["resources"] = [];
    const seen = new Set<string>();
    const output = (next?: Position): ListResourcesResult => ({
      resources,
      ...(next ? { nextCursor: encode(next, aad) } : {}),
    });
    const fits = (entry: Readonly<Record<string, unknown>>, next?: Position): boolean =>
      Buffer.byteLength(JSON.stringify({
        ...output(next), resources: [...resources, entry],
        resultType: "complete", ttlMs: 0, cacheScope: "private",
        _meta: { "io.modelcontextprotocol/serverInfo": options.serverInfo },
      }), "utf8") <= options.maxPageBytes;
    const append = (entry: Readonly<Record<string, unknown>>, next?: Position): boolean => {
      if (!fits(entry, next)) {
        if (resources.length === 0) throw new Error("Inventory entry exceeds page bounds");
        return false;
      }
      const uri = entry.uri as string;
      if (seen.has(uri)) throw new Error("Duplicate inventory URI");
      seen.add(uri);
      resources.push(entry as unknown as ListResourcesResult["resources"][number]);
      return true;
    };
    while (position.source <= sources.length) {
      context.signal.throwIfAborted();
      if (Date.now() >= context.deadlineMs) throw new Error("Inventory deadline exceeded");
      if (position.source === 0) {
        if (position.offset > staticEntries.length) throw new Error("Invalid static inventory position");
        while (position.offset < staticEntries.length) {
          const next: Position = { source: 0, offset: position.offset + 1, expires: position.expires };
          if (!append(staticEntries[position.offset]!, next)) return output(position);
          position = next;
          if (resources.length === options.pageSize) return output(position);
        }
        position = { source: 1, offset: 0, expires: position.expires };
        continue;
      }
      const source = sources[position.source - 1]!;
      const limit = options.pageSize - resources.length;
      const raw = await source.list(Object.freeze({ after: position.after, limit }), context);
      context.signal.throwIfAborted();
      const serialized = JSON.stringify(raw);
      if (serialized === undefined || Buffer.byteLength(serialized) > options.maxBackendBytes)
        throw new Error("Inventory backend result exceeds bounds");
      const page = pageSchema.parse(JSON.parse(serialized));
      if (page.entries.length > limit || page.hasMore && page.entries.length === 0)
        throw new Error("Invalid inventory backend page");
      let previous = position.after;
      const batchUris = new Set<string>();
      for (const entry of page.entries) {
        if (previous !== undefined && entry.key <= previous || !source.matches(entry.resource.uri) ||
            batchUris.has(entry.resource.uri)) throw new Error("Invalid inventory ordering or URI");
        new URL(entry.resource.uri);
        batchUris.add(entry.resource.uri);
        previous = entry.key;
      }
      for (const [index, entry] of page.entries.entries()) {
        const hasNext = index + 1 < page.entries.length || page.hasMore || position.source < sources.length;
        const next: Position = { source: position.source, offset: 0, after: entry.key, expires: position.expires };
        if (!append(entry.resource, hasNext ? next : undefined)) return output(position);
        position = next;
      }
      if (page.hasMore) return output(position);
      position = { source: position.source + 1, offset: 0, expires: position.expires };
      if (resources.length === options.pageSize)
        return output(position.source <= sources.length ? position : undefined);
    }
    return output();
  };
}
