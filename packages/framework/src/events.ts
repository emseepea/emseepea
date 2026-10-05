import type { AuthInfo } from "@modelcontextprotocol/server";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { z, type ZodType } from "zod";
import { postCheckedWebhook, signWebhook } from "./events-webhook.js";

export interface McpEventDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType;
  readonly payloadSchema: ZodType;
  readonly listWire?: (
    ownerKey: string,
    wire: NormalizedEventDefinition["wire"],
  ) => NormalizedEventDefinition["wire"] | undefined |
    Promise<NormalizedEventDefinition["wire"] | undefined>;
  readonly matches: (
    arguments_: Readonly<Record<string, unknown>>,
    data: Readonly<Record<string, unknown>>,
    ownerKey: string,
  ) => boolean;
}

export interface McpEventSubscription {
  readonly id: string;
  readonly ownerKey: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly url: string;
  readonly secret: string;
  readonly expiresAt: number;
  readonly verifiedUntil?: number;
  readonly previousSecret?: string;
  readonly previousSecretUntil?: number;
}

export interface McpEventStore {
  /** Implementations must persist records and make put/delete atomic across instances. */
  get(id: string): Promise<McpEventSubscription | null>;
  put(subscription: McpEventSubscription): Promise<void>;
  delete(id: string): Promise<void>;
  list(name: string): Promise<readonly McpEventSubscription[]>;
  /** Atomic, durable queue operations. claimDue must lease jobs across instances. */
  enqueue(delivery: McpEventDelivery): Promise<void>;
  claimDue(limit: number, now: number, leaseMs: number): Promise<readonly McpClaimedEventDelivery[]>;
  /** Apply only if the lease still matches; a stale worker must not resurrect a completed delivery. */
  complete(id: string, leaseId: string): Promise<void>;
  reschedule(delivery: McpClaimedEventDelivery): Promise<void>;
}

export interface McpEventDelivery {
  readonly id: string;
  readonly subscriptionId: string;
  readonly eventId: string;
  readonly body: string;
  readonly attempts: number;
  readonly nextAttemptAt: number;
}

export interface McpClaimedEventDelivery extends McpEventDelivery {
  readonly leaseId: string;
}

export interface McpEventsOptions {
  readonly definitions: readonly McpEventDefinition[];
  /** Maximum time to wait for adopter callbacks, in milliseconds (default 5000). */
  readonly callbackTimeoutMs?: number;
  readonly ownerKey: (auth: AuthInfo) => string | Promise<string>;
  readonly authorize: (request: {
    readonly ownerKey: string;
    readonly name: string;
    readonly arguments: Readonly<Record<string, unknown>>;
    readonly phase: "list" | "subscribe" | "refresh" | "delivery";
  }) => boolean | Promise<boolean>;
  readonly health: () => boolean | Promise<boolean>;
  readonly store: McpEventStore;
}

export interface NormalizedEventDefinition extends McpEventDefinition {
  readonly wire: Readonly<{
    name: string;
    description: string;
    delivery: readonly ["webhook"];
    inputSchema: Record<string, unknown>;
    payloadSchema: Record<string, unknown>;
  }>;
}

export interface McpEventRuntime {
  readonly definitions: readonly NormalizedEventDefinition[];
  ownerKey(auth: AuthInfo): Promise<string>;
  list(ownerKey: string): Promise<readonly NormalizedEventDefinition["wire"][]>;
  validateSubscription(params: unknown): {
    readonly definition: NormalizedEventDefinition;
    readonly arguments: Readonly<Record<string, unknown>>;
    readonly url: string;
    readonly secret: string;
  };
  subscribe(ownerKey: string, params: unknown): Promise<{
    readonly id: string;
    readonly refreshBefore: string;
    readonly cursor: null;
    readonly truncated: false;
  }>;
  unsubscribe(ownerKey: string, params: unknown): Promise<void>;
  publish(
    name: string,
    data: Readonly<Record<string, unknown>>,
    audience?: Readonly<{ ownerKey: string }>,
  ): Promise<void>;
  drain(): Promise<void>;
  ready(): Promise<boolean>;
}

export class McpEventInputError extends Error {
  constructor(readonly code: number, readonly reason: string) {
    super(code === -32015 ? "Callback endpoint rejected" : "Invalid event subscription");
  }
}

export function createMcpEventRuntime(
  options: McpEventsOptions,
  webhookPost: typeof postCheckedWebhook = postCheckedWebhook,
): McpEventRuntime {
  if (!options || typeof options !== "object" || !Array.isArray(options.definitions) ||
      options.definitions.length === 0 || options.definitions.length > 100 ||
      typeof options.ownerKey !== "function" ||
      typeof options.authorize !== "function" || typeof options.health !== "function" ||
      !options.store || typeof options.store !== "object" ||
      ["get", "put", "delete", "list", "enqueue", "claimDue", "complete", "reschedule"].some((method) =>
        typeof options.store[method as keyof McpEventStore] !== "function")) {
    throw new TypeError("events require definitions, ownerKey, authorize, health, and a durable store");
  }
  const callbackTimeoutMs = options.callbackTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(callbackTimeoutMs) || callbackTimeoutMs < 1 || callbackTimeoutMs > 10_000)
    throw new TypeError("events.callbackTimeoutMs must be between 1 and 10000");
  const bounded = async <T>(callback: () => T | Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(callback),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Event callback deadline exceeded")), callbackTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const names = new Set<string>();
  const definitions = Object.freeze(options.definitions.map((definition) => {
    if (!definition || typeof definition.name !== "string" ||
        !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(definition.name) ||
        names.has(definition.name) || typeof definition.description !== "string" ||
        !definition.description.trim() || typeof definition.matches !== "function" ||
        !(definition.inputSchema instanceof z.ZodType) ||
        !(definition.payloadSchema instanceof z.ZodType)) {
      throw new TypeError("events require unique named definitions with schemas and a matcher");
    }
    names.add(definition.name);
    const inputSchema = z.toJSONSchema(definition.inputSchema);
    const payloadSchema = z.toJSONSchema(definition.payloadSchema);
    if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema) ||
        inputSchema.type !== "object" || !payloadSchema || typeof payloadSchema !== "object" ||
        Array.isArray(payloadSchema) || payloadSchema.type !== "object") {
      throw new TypeError("event schemas must describe objects");
    }
    const wire = Object.freeze({
      name: definition.name,
      description: definition.description,
      delivery: Object.freeze(["webhook"] as const),
      inputSchema: deepFreeze(inputSchema),
      payloadSchema: deepFreeze(payloadSchema),
    });
    return Object.freeze({ ...definition, wire });
  }));
  const subscriptionIdentity = (ownerKey: string, name: string,
    args: Readonly<Record<string, unknown>>, url: string) =>
    `sub_${createHash("sha256").update(JSON.stringify([ownerKey, name, canonical(args), url])).digest("hex")}`;
  const validateUnsubscribe = (params: unknown) => {
    if (!params || typeof params !== "object" || Array.isArray(params))
      throw new McpEventInputError(-32602, "invalid_params");
    const request = params as Record<string, unknown>;
    const definition = definitions.find((item) => item.name === request.name);
    if (!definition || !request.arguments || typeof request.arguments !== "object" ||
        Array.isArray(request.arguments)) throw new McpEventInputError(-32602, "invalid_params");
    const parsed = definition.inputSchema.safeParse(request.arguments);
    if (!parsed.success || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data))
      throw new McpEventInputError(-32602, "invalid_arguments");
    const delivery = request.delivery;
    if (!delivery || typeof delivery !== "object" || Array.isArray(delivery) ||
        (delivery as Record<string, unknown>).mode !== "webhook" ||
        typeof (delivery as Record<string, unknown>).url !== "string")
      throw new McpEventInputError(-32602, "invalid_delivery");
    let url: URL;
    const callbackUrl = (delivery as Record<string, unknown>).url;
    if (typeof callbackUrl !== "string") throw new McpEventInputError(-32602, "invalid_delivery");
    try { url = new URL(callbackUrl); }
    catch { throw new McpEventInputError(-32602, "invalid_delivery"); }
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
        url.port && url.port !== "443" || isIP(url.hostname) !== 0)
      throw new McpEventInputError(-32602, "invalid_delivery");
    return { definition, arguments: parsed.data as Record<string, unknown>, url: url.href };
  };
  const runtime: McpEventRuntime = {
    definitions,
    async ownerKey(auth: AuthInfo) {
      const ownerKey = await bounded(() => options.ownerKey(auth));
      if (typeof ownerKey !== "string" || !ownerKey.trim() ||
          Buffer.byteLength(ownerKey, "utf8") > 256) {
        throw new TypeError("events.ownerKey must return a stable nonempty key of at most 256 bytes");
      }
      return ownerKey;
    },
    async list(ownerKey: string) {
      const allowed = [];
      for (const definition of definitions) {
        if (await bounded(() => options.authorize({ ownerKey, name: definition.name,
          arguments: {}, phase: "list" })) !== true) continue;
        if (definition.listWire) {
          const wire = await bounded(() => definition.listWire?.(ownerKey, definition.wire));
          if (wire) allowed.push(checkedListWire(definition, wire));
          continue;
        }
        allowed.push(definition.wire);
      }
      return allowed;
    },
    validateSubscription(params: unknown) {
      if (!params || typeof params !== "object" || Array.isArray(params)) {
        throw new McpEventInputError(-32602, "invalid_params");
      }
      const request = params as Record<string, unknown>;
      const definition = definitions.find((item) => item.name === request.name);
      if (!definition || !request.arguments || typeof request.arguments !== "object" ||
          Array.isArray(request.arguments) ||
          request.cursor !== null && request.cursor !== undefined) {
        throw new McpEventInputError(-32602, "invalid_params");
      }
      const parsed = definition.inputSchema.safeParse(request.arguments);
      if (!parsed.success || !parsed.data || typeof parsed.data !== "object" ||
          Array.isArray(parsed.data)) {
        throw new McpEventInputError(-32602, "invalid_arguments");
      }
      const delivery = request.delivery;
      if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
        throw new McpEventInputError(-32602, "invalid_delivery");
      }
      const { mode, url, secret } = delivery as Record<string, unknown>;
      if (mode !== "webhook" || typeof url !== "string" || typeof secret !== "string" ||
          !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) {
        throw new McpEventInputError(-32602, "invalid_delivery");
      }
      const decoded = Buffer.from(secret.slice(6), "base64");
      if (decoded.length < 24 || decoded.length > 64 ||
          decoded.toString("base64") !== secret.slice(6)) {
        throw new McpEventInputError(-32602, "invalid_secret");
      }
      let callback: URL;
      try { callback = new URL(url); }
      catch { throw new McpEventInputError(-32015, "invalid_url"); }
      if (callback.protocol !== "https:" || callback.username || callback.password ||
          callback.hash || callback.port && callback.port !== "443" ||
          Buffer.byteLength(callback.href, "utf8") > 8192 ||
          !callback.hostname || isIP(callback.hostname) !== 0 ||
          callback.hostname === "localhost" || callback.hostname.endsWith(".localhost") ||
          callback.hostname.endsWith(".local")) {
        throw new McpEventInputError(-32015, "invalid_url");
      }
      return { definition, arguments: parsed.data as Record<string, unknown>, url: callback.href, secret };
    },
    async subscribe(ownerKey: string, params: unknown) {
      const valid = runtime.validateSubscription(params);
      const request = params as Record<string, unknown>;
      const ttlMs = request.ttlMs;
      if (ttlMs !== undefined && ttlMs !== null &&
          (!Number.isSafeInteger(ttlMs) || Number(ttlMs) <= 0))
        throw new McpEventInputError(-32602, "invalid_ttl");
      const id = subscriptionIdentity(ownerKey, valid.definition.name, valid.arguments, valid.url);
      const prior = await bounded(() => options.store.get(id));
      if (!await bounded(() => options.authorize({ ownerKey, name: valid.definition.name,
        arguments: valid.arguments, phase: prior ? "refresh" : "subscribe" })))
        throw new McpEventInputError(-32602, "capability_not_found");
      const now = Date.now();
      if (!prior || prior.secret !== valid.secret || !prior.verifiedUntil || prior.verifiedUntil < now) {
        const challenge = randomBytes(32).toString("base64url");
        const messageId = `msg_verification_${randomBytes(16).toString("hex")}`;
        const body = Buffer.from(JSON.stringify({ type: "verification", challenge }));
        const timestamp = Math.floor(now / 1000);
        try {
          const response = await webhookPost(valid.url, body, {
            "webhook-id": messageId,
            "webhook-timestamp": String(timestamp),
            "webhook-signature": signWebhook(valid.secret, messageId, timestamp, body),
            "X-MCP-Subscription-Id": id,
          });
          if (response.status < 200 || response.status > 299) {
            throw new McpEventInputError(-32015, "challenge_failed");
          }
          const answer: unknown = JSON.parse(response.body.toString("utf8"));
          const actual = answer && typeof answer === "object" && !Array.isArray(answer)
            ? (answer as Record<string, unknown>).challenge : undefined;
          if (typeof actual !== "string" ||
              !timingSafeEqual(createHash("sha256").update(actual).digest(),
                createHash("sha256").update(challenge).digest())) {
            throw new McpEventInputError(-32015, "challenge_failed");
          }
        } catch (error) {
          if (error instanceof McpEventInputError) throw error;
          throw new McpEventInputError(-32015, "challenge_failed");
        }
      }
      const expiresAt = now + Math.min(typeof ttlMs === "number" ? ttlMs : 86_400_000, 86_400_000);
      await bounded(() => options.store.put({
        id, ownerKey, name: valid.definition.name, arguments: valid.arguments,
        url: valid.url, secret: valid.secret, expiresAt, verifiedUntil: now + 600_000,
        ...(prior && prior.secret !== valid.secret ? {
          previousSecret: prior.secret, previousSecretUntil: now + 300_000,
        } : {}),
      }));
      return { id, refreshBefore: new Date(expiresAt).toISOString(), cursor: null, truncated: false };
    },
    async unsubscribe(ownerKey: string, params: unknown) {
      const valid = validateUnsubscribe(params);
      const id = subscriptionIdentity(ownerKey, valid.definition.name, valid.arguments, valid.url);
      const prior = await bounded(() => options.store.get(id));
      if (prior && prior.ownerKey === ownerKey) await bounded(() => options.store.delete(id));
    },
    async publish(
      name: string,
      data: Readonly<Record<string, unknown>>,
      audience?: Readonly<{ ownerKey: string }>,
    ) {
      if (!await runtime.ready()) throw new Error("Events are unavailable");
      const definition = definitions.find((item) => item.name === name);
      if (!definition) throw new TypeError("Event name is not registered");
      const audienceOwnerKey = audience?.ownerKey;
      if (audienceOwnerKey !== undefined &&
          (typeof audienceOwnerKey !== "string" || !audienceOwnerKey.trim() ||
            Buffer.byteLength(audienceOwnerKey, "utf8") > 256)) {
        throw new TypeError(
          "Set audience.ownerKey to a stable, non-empty key of at most 256 bytes.",
        );
      }
      const checked = definition.payloadSchema.safeParse(data);
      if (!checked.success || !checked.data || typeof checked.data !== "object" || Array.isArray(checked.data))
        throw new TypeError("Event data does not match payload schema");
      const eventId = `evt_${randomUUID()}`;
      const body = JSON.stringify({ eventId, name, timestamp: new Date().toISOString(),
        data: checked.data, cursor: null });
      if (Buffer.byteLength(body, "utf8") > 262_144) throw new TypeError("Event exceeds 256 KiB");
      const subscriptions = await bounded(() => options.store.list(name));
      const now = Date.now();
      for (const subscription of subscriptions) {
        if (subscription.expiresAt <= now ||
            (audienceOwnerKey !== undefined && subscription.ownerKey !== audienceOwnerKey) ||
            !definition.matches(subscription.arguments, checked.data as Record<string, unknown>,
              subscription.ownerKey)) continue;
        if (!await bounded(() => options.authorize({ ownerKey: subscription.ownerKey,
          name, arguments: subscription.arguments, phase: "delivery" }))) continue;
        await bounded(() => options.store.enqueue({
          id: `${subscription.id}:${eventId}`, subscriptionId: subscription.id,
          eventId, body, attempts: 0, nextAttemptAt: now,
        }));
      }
    },
    async drain() {
      if (!await runtime.ready()) return;
      const due = await bounded(() => options.store.claimDue(4, Date.now(), 60_000));
      for (const delivery of due) {
        if (!delivery.leaseId) throw new Error("Event store returned an unleased delivery");
        const subscription = await bounded(() => options.store.get(delivery.subscriptionId));
        if (!subscription || subscription.expiresAt <= Date.now() ||
            !await bounded(() => options.authorize({ ownerKey: subscription.ownerKey, name: subscription.name,
              arguments: subscription.arguments, phase: "delivery" }))) {
          await bounded(() => options.store.complete(delivery.id, delivery.leaseId));
          continue;
        }
        const body = Buffer.from(delivery.body);
        const timestamp = Math.floor(Date.now() / 1000);
        let status = 0;
        try {
          const signature = signWebhook(subscription.secret, delivery.eventId, timestamp, body);
          const oldSignature = subscription.previousSecret && subscription.previousSecretUntil &&
            subscription.previousSecretUntil > Date.now()
            ? ` ${signWebhook(subscription.previousSecret, delivery.eventId, timestamp, body)}` : "";
          const response = await webhookPost(subscription.url, body, {
            "webhook-id": delivery.eventId,
            "webhook-timestamp": String(timestamp),
            "webhook-signature": `${signature}${oldSignature}`,
            "X-MCP-Subscription-Id": subscription.id,
          });
          status = response.status;
        } catch { /* Retry transient delivery failures below. */ }
        if (status >= 200 && status < 300 || status === 410 || status === 413 || delivery.attempts >= 3) {
          await bounded(() => options.store.complete(delivery.id, delivery.leaseId));
        } else {
          await bounded(() => options.store.reschedule({ ...delivery, attempts: delivery.attempts + 1,
            nextAttemptAt: Date.now() + Math.min(60_000, 1000 * 5 ** delivery.attempts) }));
        }
      }
    },
    async ready() {
      try { return await bounded(() => options.health()) === true; }
      catch { return false; }
    },
  };
  return Object.freeze(runtime);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

function checkedListWire(
  definition: NormalizedEventDefinition,
  wire: NormalizedEventDefinition["wire"],
): NormalizedEventDefinition["wire"] {
  if (!wire || typeof wire !== "object" ||
      wire.name !== definition.wire.name || wire.description !== definition.wire.description ||
      !Array.isArray(wire.delivery) || wire.delivery.length !== 1 || wire.delivery[0] !== "webhook" ||
      !wire.inputSchema || typeof wire.inputSchema !== "object" || Array.isArray(wire.inputSchema) ||
      wire.inputSchema.type !== "object" ||
      !wire.payloadSchema || typeof wire.payloadSchema !== "object" || Array.isArray(wire.payloadSchema) ||
      wire.payloadSchema.type !== "object") {
    throw new TypeError(
      "Return an event catalogue projection that preserves the checked event name, " +
      "description, delivery mode, and object schemas.",
    );
  }
  return deepFreeze(wire);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
