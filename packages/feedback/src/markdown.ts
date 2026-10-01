import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { FeedbackSubmissionBackend } from "./index.js";

export interface MarkdownFeedbackOptions {
  /** Local directory selected by the application. Keep it out of public source control. */
  readonly directory: string;
}

/** One-way feedback storage. This adapter does not provide support conversations. */
export function createMarkdownFeedbackSubmissionBackend<Context = undefined>(
  options: MarkdownFeedbackOptions,
): FeedbackSubmissionBackend<Context> {
  if (!isAbsolute(options.directory)) throw new Error("Markdown feedback directory must be absolute");
  const root = resolve(options.directory);
  return {
    async submit(command, context) {
      context.signal.throwIfAborted();
      if (Date.now() >= context.deadlineMs) throw new DOMException("The feedback deadline expired", "TimeoutError");
      const id = randomUUID();
      const recordedAt = new Date().toISOString();
      const scopeKey = createHash("sha256").update(context.scope).digest("hex");
      const scopeDirectory = join(root, scopeKey);
      const finalPath = join(scopeDirectory, `${id}.md`);
      const temporaryPath = join(scopeDirectory, `.${id}.tmp`);
      const payload = `# Feedback ${id}\n\n- Observation: \`${command.observation}\`\n- Recorded at: \`${recordedAt}\`\n\n## Detail\n\n${fenced(command.detail, "text")}\n\n## Context\n\n${fenced(JSON.stringify(command.context ?? null, null, 2), "json")}\n`;
      const events = [{
        id: `feedback.message.added:${id}`,
        type: "feedback.message.added" as const,
        occurredAt: recordedAt,
        threadId: id,
        messageId: id,
        author: "user" as const,
      }];

      const repository = await findGitRepository(root);
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      await ensureDirectory(root);
      if (repository) await ensureGitIgnore(root, repository);
      await fs.mkdir(scopeDirectory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      await ensureDirectory(scopeDirectory);
      context.signal.throwIfAborted();
      if (Date.now() >= context.deadlineMs) throw new DOMException("The feedback deadline expired", "TimeoutError");
      let created = false;
      try {
        const file = await fs.open(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
        created = true;
        try {
          await file.writeFile(payload, { encoding: "utf8", signal: context.signal });
          await file.sync();
        } finally {
          await file.close();
        }
        context.signal.throwIfAborted();
        if (Date.now() >= context.deadlineMs) throw new DOMException("The feedback deadline expired", "TimeoutError");
        await fs.rename(temporaryPath, finalPath);
        created = false;
        const directory = await fs.open(scopeDirectory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      } finally {
        if (created) await fs.unlink(temporaryPath).catch(() => {});
      }
      // Once the directory entry is synced, no validation or cancellation may
      // turn recorded feedback into a failed tool response.
      return { id, recordedAt, events };
    },
  };
}

async function ensureDirectory(path: string): Promise<void> {
  const stat = await fs.lstat(path);
  if (stat.isSymbolicLink()) throw new Error("Markdown feedback directory cannot be a symlink");
  if (!stat.isDirectory()) throw new Error("Markdown feedback destination is not a directory");
}


const gitIgnoreContent = "/*\n!/.gitignore\n";

async function findGitRepository(directory: string): Promise<string | undefined> {
  let existing = directory;
  for (;;) {
    try {
      await fs.lstat(existing);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }
  let current = join(await fs.realpath(existing), relative(existing, directory));
  for (;;) {
    try {
      await fs.lstat(join(current, ".git"));
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function ensureGitIgnore(directory: string, repository: string): Promise<void> {
  const canonical = await fs.realpath(directory);
  if (canonical === repository || basename(canonical) === "docs") {
    throw new Error("Markdown feedback needs a dedicated directory inside Git");
  }
  const entries = await fs.readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.name !== ".gitignore" &&
    (!/^[a-f0-9]{64}$/.test(entry.name) || !entry.isDirectory()))) {
    throw new Error("Markdown feedback needs a dedicated directory inside Git");
  }
  const ignorePath = join(directory, ".gitignore");
  try {
    const file = await fs.open(ignorePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try {
      await file.writeFile(gitIgnoreContent, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    const parent = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const stat = await fs.lstat(ignorePath);
  if (!stat.isFile() || stat.isSymbolicLink() || await fs.readFile(ignorePath, "utf8") !== gitIgnoreContent) {
    throw new Error("Markdown feedback requires its safe Git ignore rule");
  }
}

function fenced(value: string, language: string): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map(([run]) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}
