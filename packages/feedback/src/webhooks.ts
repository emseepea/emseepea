import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { beforeDeadline } from "./deadline.js";
import { feedbackEventSchema } from "./index.js";
import type { FeedbackAdapterContext, FeedbackEvent } from "./index.js";

const maximumWebhookBytes = 64 * 1024;
const timestamp = z.iso.datetime({ offset: true });
const githubPayloadSchema = z.object({
  action: z.string().min(1),
  repository: z.object({ full_name: z.string().min(3) }),
  issue: z.object({
    number: z.number().int().positive(),
    updated_at: timestamp,
    labels: z.array(z.object({ name: z.string() })),
  }),
  comment: z.object({
    id: z.number().int().positive(),
    body: z.string(),
    created_at: timestamp,
  }).optional(),
});
const zendeskPayloadSchema = z.strictObject({
  eventId: z.string().min(1).max(240),
  subdomain: z.string().min(1).max(63),
  ticketId: z.number().int().positive(),
  scopeTag: z.string().regex(/^emseepea_[a-f0-9]{24}$/),
  occurredAt: timestamp,
  change: z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("public_comment"),
      commentId: z.number().int().positive(),
      author: z.enum(["user", "team"]),
    }),
    z.strictObject({ type: z.literal("status_changed") }),
  ]),
});

export interface FeedbackWebhookStore {
  claim(eventId: string, context: FeedbackAdapterContext): boolean | Promise<boolean>;
  resolveScope(scopeHash: string, context: FeedbackAdapterContext): string | undefined | Promise<string | undefined>;
}

interface WebhookInput {
  readonly body: Uint8Array;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export async function ingestGitHubFeedbackWebhook(
  input: WebhookInput,
  options: Readonly<{
    secret: string;
    owner: string;
    repository: string;
    store: FeedbackWebhookStore;
  }>,
  context: FeedbackAdapterContext,
): Promise<readonly FeedbackEvent[]> {
  const body = checkedBody(input.body);
  verifyHexSignature(input.headers["x-hub-signature-256"], checkedSecret(options.secret), body);
  const delivery = requiredHeader(input.headers, "x-github-delivery");
  const kind = requiredHeader(input.headers, "x-github-event");
  const payload = githubPayloadSchema.parse(JSON.parse(new TextDecoder().decode(body)));
  if (payload.repository.full_name !== `${options.owner}/${options.repository}`) {
    throw new Error("GitHub feedback webhook targeted the wrong repository");
  }
  const labels = payload.issue.labels.filter(({ name }) => name.startsWith("emseepea-"));
  if (labels.length !== 1) throw new Error("GitHub feedback webhook must have exactly one feedback scope");
  const label = labels[0]!;
  const scope = await resolveScope(options.store, label.name.slice("emseepea-".length), context);
  const event = githubEvent(kind, delivery, payload, scope);
  if (!await beforeDeadline(Promise.resolve(options.store.claim(`github:${delivery}`, context)), context)) return [];
  return Object.freeze([Object.freeze(feedbackEventSchema.parse(event))]);
}

export async function ingestZendeskFeedbackWebhook(
  input: WebhookInput,
  options: Readonly<{
    secret: string;
    subdomain: string;
    store: FeedbackWebhookStore;
  }>,
  context: FeedbackAdapterContext,
): Promise<readonly FeedbackEvent[]> {
  const body = checkedBody(input.body);
  const sentAt = requiredHeader(input.headers, "x-zendesk-webhook-signature-timestamp");
  verifyBase64Signature(
    input.headers["x-zendesk-webhook-signature"],
    checkedSecret(options.secret),
    new TextEncoder().encode(`${sentAt}${new TextDecoder().decode(body)}`),
  );
  const payload = zendeskPayloadSchema.parse(JSON.parse(new TextDecoder().decode(body)));
  if (payload.subdomain !== options.subdomain) {
    throw new Error("Zendesk feedback webhook targeted the wrong account");
  }
  const scope = await resolveScope(options.store, payload.scopeTag.slice("emseepea_".length), context);
  if (!await beforeDeadline(Promise.resolve(options.store.claim(`zendesk:${payload.eventId}`, context)), context)) return [];
  const threadId = `zendesk-ticket-${payload.ticketId}`;
  const change = payload.change;
  return Object.freeze([Object.freeze(feedbackEventSchema.parse({
    id: `zendesk:${payload.eventId}`,
    type: change.type === "status_changed" ? "feedback.status.changed" : "feedback.message.added",
    occurredAt: payload.occurredAt,
    scope,
    threadId,
    ...(change.type === "public_comment" ? {
      messageId: `zendesk-comment-${change.commentId}`,
      author: change.author,
    } : {}),
  }))]);
}

function githubEvent(
  kind: string,
  delivery: string,
  payload: z.output<typeof githubPayloadSchema>,
  scope: string,
): FeedbackEvent {
  const threadId = `github-issue-${payload.issue.number}`;
  if (kind === "issue_comment" && payload.action === "created" && payload.comment) {
    return Object.freeze({
      id: `github:${delivery}`,
      type: "feedback.message.added",
      occurredAt: payload.comment.created_at,
      scope,
      threadId,
      messageId: `github-comment-${payload.comment.id}`,
      author: payload.comment.body.startsWith("<!-- emseepea-feedback:user -->") ? "user" : "team",
    });
  }
  if (kind === "issues" && ["assigned", "closed", "labeled", "milestoned", "reopened", "unassigned", "unlabeled"].includes(payload.action)) {
    return Object.freeze({
      id: `github:${delivery}`,
      type: "feedback.status.changed",
      occurredAt: payload.issue.updated_at,
      scope,
      threadId,
    });
  }
  throw new Error("Unsupported GitHub feedback webhook event");
}

async function resolveScope(
  store: FeedbackWebhookStore,
  hash: string,
  context: FeedbackAdapterContext,
): Promise<string> {
  const scope = await beforeDeadline(Promise.resolve(store.resolveScope(hash, context)), context);
  return z.string().min(1).max(240).parse(scope);
}

function checkedBody(body: Uint8Array): Uint8Array {
  if (body.byteLength === 0 || body.byteLength > maximumWebhookBytes) {
    throw new Error("Feedback webhook body is empty or exceeded 64 KiB");
  }
  return body;
}

function checkedSecret(secret: string): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Feedback webhook secret must be at least 32 bytes");
  }
  return secret;
}

function requiredHeader(headers: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = headers[name];
  if (!value) throw new Error(`Feedback webhook is missing ${name}`);
  return value;
}

function verifyHexSignature(value: string | undefined, secret: string, body: Uint8Array): void {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  verifySignature(value, expected);
}

function verifyBase64Signature(value: string | undefined, secret: string, body: Uint8Array): void {
  verifySignature(value, createHmac("sha256", secret).update(body).digest("base64"));
}

function verifySignature(value: string | undefined, expected: string): void {
  if (!value) throw new Error("Feedback webhook signature is missing");
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error("Feedback webhook signature is invalid");
  }
}
