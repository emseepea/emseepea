import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

const proposalSchema = z.strictObject({
  principalId: z.string().min(1).max(512),
  scopeId: z.string().min(1).max(512),
  tool: z.string().min(1).max(128),
  input: z.json(),
  effect: z.json(),
  formSchema: z.json(),
});
export type ExternalApprovalProposal = z.infer<typeof proposalSchema>;

const recordSchema = z.strictObject({
  capsuleDigest: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
  state: z.enum(["pending", "approved", "cancelled", "consumed"]),
});
export type ExternalApprovalRecord = Readonly<z.infer<typeof recordSchema>>;

/** CAS must compare the entire expected record atomically across all instances. */
export interface ExternalApprovalStore {
  load(key: string): Promise<ExternalApprovalRecord | null>;
  compareAndSwap(
    key: string,
    expected: ExternalApprovalRecord | null,
    replacement: ExternalApprovalRecord,
  ): Promise<boolean>;
}

export interface ExternalApprovalOptions {
  readonly key: Uint8Array;
  readonly store: ExternalApprovalStore;
  readonly lifetimeMs: number;
  readonly maxCapsuleBytes: number;
  readonly now?: () => number;
}

declare const VERIFIED_EXTERNAL_APPROVAL: unique symbol;
export type ExternalApprovalOutcome =
  | { readonly status: "missing" | "pending" | "cancelled" | "expired" | "used" }
  | { readonly status: "approved"; readonly [VERIFIED_EXTERNAL_APPROVAL]: true };

const capsuleSchema = z.strictObject({
  version: z.literal(1),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
  proposal: proposalSchema,
});
const aad = Buffer.from("emseepea.external-approval.v1");

function invalid(): never {
  throw new Error("External approval is unavailable or invalid");
}

function canonical(value: unknown, depth = 0): string {
  if (depth > 32) invalid();
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, depth + 1)).join(",")}]`;
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], depth + 1)}`).join(",")}}`;
  }
  return invalid();
}

/**
 * An opt-in primitive, not an HTTP route or effect executor. Page adapters must
 * supply the authenticated principal, enforce CSRF, and keep the capsule in a
 * URL fragment or POST body, never a server-visible URL query or application log.
 * Applications must recheck permissions/freshness and retain effect idempotency.
 */
export function createExternalApprovalBroker(options: ExternalApprovalOptions) {
  const { key: configuredKey, store, lifetimeMs, maxCapsuleBytes, now: configuredClock } = options;
  if (!(configuredKey instanceof Uint8Array) || configuredKey.byteLength !== 32 ||
      !Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > 3_600_000 ||
      !Number.isSafeInteger(maxCapsuleBytes) || maxCapsuleBytes <= 0 || maxCapsuleBytes > 131_072 ||
      (configuredClock !== undefined && typeof configuredClock !== "function") ||
      typeof store?.load !== "function" || typeof store?.compareAndSwap !== "function") {
    throw new TypeError("External approval requires a 32-byte key, atomic store and bounded lifetime/size");
  }
  const key = Buffer.from(configuredKey);
  const now = configuredClock ?? Date.now;
  const timestamp = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) invalid();
    return value;
  };
  const digest = (domain: string, value: string) => createHmac("sha256", key).update(`${domain}\0${value}`).digest("hex");
  const checkedProposal = (value: ExternalApprovalProposal) => {
    // Bound nesting before recursive JSON schema validation, and freeze the
    // serialized proposal before any asynchronous store operation.
    const encoded = canonical(value);
    if (Buffer.byteLength(encoded) > maxCapsuleBytes) invalid();
    const result = proposalSchema.safeParse(JSON.parse(encoded));
    if (!result.success) invalid();
    return result.data;
  };
  const recordFor = async (id: string) => {
    let value: ExternalApprovalRecord | null;
    try { value = await store.load(id); } catch { return invalid(); }
    if (value === null) return null;
    const result = recordSchema.safeParse(value);
    if (!result.success) invalid();
    return result.data;
  };
  const transition = async (id: string, expected: ExternalApprovalRecord | null, next: ExternalApprovalRecord) => {
    try {
      const success = await store.compareAndSwap(id, expected, next);
      if (typeof success !== "boolean") invalid();
      return success;
    } catch { return invalid(); }
  };
  const proposalId = (value: ExternalApprovalProposal) => digest("proposal", canonical(value));
  const seal = (value: z.infer<typeof capsuleSchema>) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    const token = `1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
    if (Buffer.byteLength(token) > maxCapsuleBytes) invalid();
    return token;
  };
  const open = (token: string, principalId: string) => {
    try {
      if (typeof token !== "string" || Buffer.byteLength(token) > maxCapsuleBytes) invalid();
      const parts = token.split(".");
      if (parts.length !== 4 || parts[0] !== "1") invalid();
      const decode = (value: string) => {
        const bytes = Buffer.from(value, "base64url");
        if (bytes.toString("base64url") !== value) invalid();
        return bytes;
      };
      const iv = decode(parts[1]!);
      const ciphertext = decode(parts[2]!);
      const tag = decode(parts[3]!);
      if (iv.byteLength !== 12 || tag.byteLength !== 16) invalid();
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      const text = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      const parsed: unknown = JSON.parse(text);
      canonical(parsed);
      const capsule = capsuleSchema.parse(parsed);
      const at = timestamp();
      if (capsule.proposal.principalId !== principalId || capsule.issuedAt > at ||
          capsule.expiresAt <= at || capsule.expiresAt - capsule.issuedAt !== lifetimeMs) invalid();
      return capsule;
    } catch { return invalid(); }
  };
  const current = async (token: string, principalId: string) => {
    const capsule = open(token, principalId);
    const id = proposalId(capsule.proposal);
    const record = await recordFor(id);
    if (!record || record.capsuleDigest !== digest("capsule", token) ||
        record.expiresAt !== capsule.expiresAt || record.expiresAt <= timestamp()) invalid();
    return { capsule, id, record };
  };

  return Object.freeze({
    async prepare(value: ExternalApprovalProposal) {
      const proposal = checkedProposal(value);
      const id = proposalId(proposal);
      const expected = await recordFor(id);
      const at = timestamp();
      // An active request (including cancellation/consumption) is terminal for
      // this proposal. Restart explicitly after expiry; never silently renew it.
      if (expected && expected.expiresAt > at) invalid();
      const expiresAt = at + lifetimeMs;
      if (!Number.isSafeInteger(expiresAt)) invalid();
      const capsule = seal({ version: 1, issuedAt: at, expiresAt, nonce: randomBytes(16).toString("hex"), proposal });
      const record: ExternalApprovalRecord = { capsuleDigest: digest("capsule", capsule), expiresAt, state: "pending" };
      if (!await transition(id, expected, record)) invalid();
      return { capsule, expiresAt };
    },
    async review(token: string, principalId: string) {
      const { capsule, record } = await current(token, principalId);
      if (record.state !== "pending") invalid();
      return capsule.proposal;
    },
    async decide(token: string, principalId: string, decision: "approve" | "cancel") {
      if (decision !== "approve" && decision !== "cancel") invalid();
      const { id, record } = await current(token, principalId);
      if (record.state !== "pending") invalid();
      const state = decision === "approve" ? "approved" : "cancelled";
      if (!await transition(id, record, { ...record, state })) invalid();
      if (record.expiresAt <= timestamp()) invalid();
      return { status: state } as const;
    },
    async consume(value: ExternalApprovalProposal): Promise<ExternalApprovalOutcome> {
      const proposal = checkedProposal(value);
      const id = proposalId(proposal);
      const record = await recordFor(id);
      if (!record) return { status: "missing" };
      if (record.expiresAt <= timestamp()) return { status: "expired" };
      if (record.state === "pending" || record.state === "cancelled") return { status: record.state };
      if (record.state === "consumed") return { status: "used" };
      if (!await transition(id, record, { ...record, state: "consumed" })) return { status: "used" };
      if (record.expiresAt <= timestamp()) return { status: "expired" };
      return { status: "approved" } as ExternalApprovalOutcome;
    },
  });
}
