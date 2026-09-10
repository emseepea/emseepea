import { createHash } from "node:crypto";
import { z } from "zod";
import { beforeDeadline } from "./deadline.js";
import { feedbackConversationSchema } from "./index.js";
import type {
  FeedbackAdapterContext,
  FeedbackBackendEvent,
  FeedbackConversationBackend,
  FeedbackMessage,
  FeedbackSubmissionBackend,
  FeedbackThread,
} from "./index.js";
import { bearerHeaders, providerRequestInit, requestJson } from "./http.js";

const githubUserSchema = z.strictObject({ login: z.string().min(1) });
const githubLabelSchema = z.union([
  z.string(),
  z.strictObject({ name: z.string().min(1) }),
]);
const githubMilestoneSchema = z.strictObject({ title: z.string().min(1) }).nullable();
const githubIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  created_at: z.string(),
  updated_at: z.string(),
  user: githubUserSchema,
  labels: z.array(githubLabelSchema),
  assignees: z.array(githubUserSchema),
  milestone: githubMilestoneSchema,
  pull_request: z.unknown().optional(),
});
const githubCommentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string().nullable(),
  created_at: z.string(),
  user: githubUserSchema,
});
const githubReactionSchema = z.object({ created_at: z.string() });
const pageSchema = z.array(githubIssueSchema);
const commentsSchema = z.array(githubCommentSchema);

const USER_MARKER = "<!-- emseepea-feedback:user -->";
const SCOPE_MARKER = "emseepea-feedback-scope:";
const issuesPerPage = 100;
const maximumIssuePagesPerCall = 10;

export interface GitHubFeedbackOptions {
  readonly owner: string;
  readonly repository: string;
  readonly token: string | (() => string | Promise<string>);
  readonly labels?: readonly string[];
  readonly apiUrl?: URL;
  readonly fetch?: typeof fetch;
}

export function createGitHubFeedbackBackend(
  options: GitHubFeedbackOptions,
): FeedbackConversationBackend {
  const fetcher = options.fetch ?? fetch;
  const base = options.apiUrl ?? new URL("https://api.github.com/");
  assertProviderUrl(base, "GitHub");
  if (!options.owner.trim() || !options.repository.trim()) {
    throw new Error("GitHub owner and repository are required");
  }
  const repoPath = `repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`;

  async function call(
    path: string,
    context: FeedbackAdapterContext,
    init: RequestInit = {},
    expected: readonly number[] = [200],
  ) {
    const token = typeof options.token === "function" ? await options.token() : options.token;
    return beforeDeadline(requestJson(fetcher, new URL(path, base), providerRequestInit(context, {
      ...init,
      headers: {
        ...bearerHeaders(token),
        "X-GitHub-Api-Version": "2022-11-28",
        ...init.headers,
      },
    }), expected), context);
  }

  return {
    async createThread({ subject, message }, context) {
      const scopeLabel = githubScopeLabel(context.scope);
      await ensureLabel(call, repoPath, scopeLabel, context);
      const response = await call(`${repoPath}/issues`, context, {
        method: "POST",
        body: JSON.stringify({
          title: subject,
          body: `${USER_MARKER}\n<!-- ${SCOPE_MARKER}${scopeHash(context.scope)} -->\n${message}`,
          labels: [...(options.labels ?? []), scopeLabel],
        }),
      }, [201]);
      const issue = githubIssueSchema.parse(response.value);
      const conversation = issueConversation(issue, []);
      const initial = conversation.messages[0]!;
      return {
        conversation,
        events: [
          event("feedback.thread.created", conversation.id, undefined, "user", issue.created_at),
          event("feedback.message.added", conversation.id, initial.id, "user", initial.createdAt),
        ],
      };
    },

    async appendMessage({ threadId, message }, context) {
      const number = issueNumber(threadId);
      await scopedIssue(call, repoPath, number, context);
      const response = await call(`${repoPath}/issues/${number}/comments`, context, {
        method: "POST",
        body: JSON.stringify({ body: `${USER_MARKER}\n${message}` }),
      }, [201]);
      const comment = githubCommentSchema.parse(response.value);
      const sequence = (await comments(call, repoPath, number, context)).findIndex(
        ({ id }) => id === comment.id,
      ) + 2;
      const mapped = githubMessage(threadId, comment, sequence);
      return {
        message: mapped,
        events: [event("feedback.message.added", threadId, mapped.id, "user", mapped.createdAt)],
      };
    },

    async listThreads({ cursor, limit }, context) {
      const scopeLabel = githubScopeLabel(context.scope);
      let position = parseCursor(cursor);
      const issues: z.output<typeof githubIssueSchema>[] = [];
      for (let pages = 0; pages < maximumIssuePagesPerCall; pages += 1) {
        const response = await call(
          `${repoPath}/issues?state=all&labels=${encodeURIComponent(scopeLabel)}&per_page=${issuesPerPage}&page=${position.page}`,
          context,
        );
        const raw = pageSchema.parse(response.value);
        for (let index = position.index; index < raw.length; index += 1) {
          const issue = raw[index]!;
          if (issue.pull_request !== undefined) continue;
          if (issues.length === limit) {
            return page(issues, encodeCursor({ page: position.page, index }));
          }
          issues.push(issue);
        }
        if (raw.length < issuesPerPage) return page(issues);
        position = { page: position.page + 1, index: 0 };
      }
      return page(issues, encodeCursor(position));
    },

    async getThread({ threadId }, context) {
      const number = issueNumber(threadId);
      const issue = await scopedIssue(call, repoPath, number, context);
      const issueComments = await comments(call, repoPath, number, context);
      const mapped = issueConversation(issue, issueComments);
      feedbackConversationSchema.parse(mapped);
      const events: FeedbackBackendEvent[] = [];
      for (const [index, comment] of issueComments.entries()) {
        if (comment.body?.startsWith(USER_MARKER)) continue;
        try {
          const reaction = await call(
            `${repoPath}/issues/comments/${comment.id}/reactions`,
            context,
            { method: "POST", body: JSON.stringify({ content: "eyes" }) },
            [200, 201],
          );
          const offeredAt = githubReactionSchema.parse(reaction.value).created_at;
          mapped.messages[index + 1] = {
            ...mapped.messages[index + 1]!,
            offeredToClientAt: offeredAt,
          };
          if (reaction.status === 201) {
            events.push(event(
              "feedback.message.offered-to-client",
              threadId,
              `github-comment-${comment.id}`,
              "team",
              offeredAt,
            ));
          }
        } catch {
          // The validated support reply is still returned when its receipt fails.
        }
      }
      return { conversation: mapped, events };
    },
  };
}

export function createGitHubFeedbackSubmissionBackend(
  options: GitHubFeedbackOptions,
): FeedbackSubmissionBackend {
  const backend = createGitHubFeedbackBackend(options);
  return {
    async submit(command, context) {
      const result = await backend.createThread({
        subject: `Feedback: ${command.observation.replaceAll("_", " ")}`,
        message: command.detail,
      }, context);
      return {
        id: result.conversation.id,
        recordedAt: result.conversation.createdAt,
        events: result.events,
      };
    },
  };
}

type GitHubCall = (
  path: string,
  context: FeedbackAdapterContext,
  init?: RequestInit,
  expected?: readonly number[],
) => Promise<{ readonly status: number; readonly value: unknown }>;

async function ensureLabel(
  call: GitHubCall,
  repoPath: string,
  label: string,
  context: FeedbackAdapterContext,
): Promise<void> {
  const existing = await call(`${repoPath}/labels/${encodeURIComponent(label)}`, context, {}, [200, 404]);
  if (existing.status === 200) return;
  await call(`${repoPath}/labels`, context, {
    method: "POST",
    body: JSON.stringify({ name: label, color: "2da44e", description: "Em See Pea feedback scope" }),
  }, [201]);
}

async function scopedIssue(
  call: GitHubCall,
  repoPath: string,
  number: number,
  context: FeedbackAdapterContext,
) {
  const response = await call(`${repoPath}/issues/${number}`, context);
  const issue = githubIssueSchema.parse(response.value);
  const labels = issue.labels.map((label) => typeof label === "string" ? label : label.name);
  if (!labels.includes(githubScopeLabel(context.scope))) throw new Error("Feedback thread not found");
  return issue;
}

async function comments(
  call: GitHubCall,
  repoPath: string,
  number: number,
  context: FeedbackAdapterContext,
) {
  const response = await call(`${repoPath}/issues/${number}/comments?per_page=100&page=1`, context);
  const values = commentsSchema.parse(response.value);
  if (values.length === 100) {
    const overflow = await call(`${repoPath}/issues/${number}/comments?per_page=1&page=101`, context);
    if (commentsSchema.parse(overflow.value).length > 0) {
      throw new Error("GitHub feedback thread exceeded the 100-comment limit");
    }
  }
  return values;
}

function issueConversation(
  issue: z.output<typeof githubIssueSchema>,
  issueComments: readonly z.output<typeof githubCommentSchema>[],
) {
  const threadId = `github-issue-${issue.number}`;
  const initialBody = stripMarkers(issue.body ?? "");
  const messages: FeedbackMessage[] = [
    {
      id: `github-issue-${issue.number}-body`,
      threadId,
      sequence: 1,
      author: "user",
      kind: "comment",
      body: initialBody,
      createdAt: issue.created_at,
    },
    ...issueComments.map((comment, index) => githubMessage(threadId, comment, index + 2)),
  ];
  return { ...githubThread(issue), messages };
}

function assertProviderUrl(value: URL, provider: string): void {
  if (value.protocol !== "https:" || value.username || value.password || value.hash) {
    throw new Error(`${provider} API URL must be HTTPS without credentials or a fragment`);
  }
}

function githubThread(issue: z.output<typeof githubIssueSchema>): FeedbackThread {
  return {
    id: `github-issue-${issue.number}`,
    subject: issue.title,
    status: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

function githubMessage(
  threadId: string,
  comment: z.output<typeof githubCommentSchema>,
  sequence: number,
): FeedbackMessage {
  const user = comment.body?.startsWith(USER_MARKER) ?? false;
  return {
    id: `github-comment-${comment.id}`,
    threadId,
    sequence,
    author: user ? "user" : "team",
    kind: "comment",
    body: stripMarkers(comment.body ?? ""),
    createdAt: comment.created_at,
  };
}

function stripMarkers(value: string): string {
  return value.replace(/^<!-- emseepea-feedback:[^>]+ -->\n?/gm, "").trim();
}

function issueNumber(threadId: string): number {
  const match = /^github-issue-(\d+)$/.exec(threadId);
  if (!match) throw new Error("Invalid GitHub feedback thread identifier");
  return Number.parseInt(match[1]!, 10);
}

function scopeHash(scope: string): string {
  return createHash("sha256").update(scope).digest("hex").slice(0, 24);
}

function githubScopeLabel(scope: string): string {
  return `emseepea-${scopeHash(scope)}`;
}

interface GitHubCursor {
  readonly page: number;
  readonly index: number;
}

function page(issues: readonly z.output<typeof githubIssueSchema>[], nextCursor?: string) {
  return { page: { threads: issues.map(githubThread), nextCursor } };
}

function encodeCursor(cursor: GitHubCursor): string {
  return Buffer.from(`${cursor.page}:${cursor.index}`).toString("base64url");
}

function parseCursor(cursor: string | undefined): GitHubCursor {
  if (cursor === undefined) return { page: 1, index: 0 };
  const match = /^(\d+):(\d+)$/.exec(Buffer.from(cursor, "base64url").toString("utf8"));
  const page = Number.parseInt(match?.[1] ?? "", 10);
  const index = Number.parseInt(match?.[2] ?? "", 10);
  if (!match || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(index) || index < 0 || index >= issuesPerPage) {
    throw new Error("Invalid GitHub feedback cursor");
  }
  return { page, index };
}

function event(
  type: FeedbackBackendEvent["type"],
  threadId: string,
  messageId: string | undefined,
  author: FeedbackBackendEvent["author"],
  occurredAt: string,
): FeedbackBackendEvent {
  return {
    id: messageId ? `${type}:${messageId}` : `${type}:${threadId}:${occurredAt}`,
    type,
    occurredAt,
    threadId,
    messageId,
    author,
  };
}
