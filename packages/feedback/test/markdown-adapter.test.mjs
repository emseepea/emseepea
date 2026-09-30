import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { mkdtemp, readFile, readdir, lstat, rm, symlink } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, mock } from "node:test";
import { createMarkdownFeedbackSubmissionBackend } from "@emseepea/feedback/markdown";

test("Markdown submissions are private, scoped, durable files with minimal events", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "emseepea-feedback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const backend = createMarkdownFeedbackSubmissionBackend({ directory: join(root, "docs", "feedback") });
  const context = { scope: "../customer", signal: new AbortController().signal, deadlineMs: Date.now() + 10_000 };
  const command = { observation: "friction", detail: "The form took three attempts.", context: { feature: "search" } };

  const first = await backend.submit(command, context);
  const second = await backend.submit(command, context);
  assert.notEqual(first.id, second.id);
  assert.equal(first.events.length, 1);
  assert.doesNotMatch(JSON.stringify(first.events), /form took|search|customer/);

  const scopeDirectories = await readdir(join(root, "docs", "feedback"));
  assert.equal(scopeDirectories.length, 1);
  assert.match(scopeDirectories[0], /^[a-f0-9]{64}$/);
  assert.equal((await lstat(join(root, "docs", "feedback", scopeDirectories[0]))).mode & 0o777, 0o700);
  const files = await readdir(join(root, "docs", "feedback", scopeDirectories[0]));
  assert.deepEqual(files.sort(), [`${first.id}.md`, `${second.id}.md`].sort());
  const file = join(root, "docs", "feedback", scopeDirectories[0], `${first.id}.md`);
  const stored = await readFile(file, "utf8");
  assert.match(stored, /Observation: `friction`/);
  assert.match(stored, /The form took three attempts\./);
  assert.match(stored, /"feature": "search"/);
  assert.equal((await lstat(file)).mode & 0o777, 0o600);
});

test("Markdown backend rejects a symlinked destination and an aborted request", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "emseepea-feedback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink(root, join(root, "linked"));
  const context = { scope: "tenant", signal: new AbortController().signal, deadlineMs: Date.now() + 10_000 };
  const command = { observation: "friction", detail: "Difficult step", context: undefined };
  await assert.rejects(createMarkdownFeedbackSubmissionBackend({ directory: join(root, "linked") }).submit(command, context), /symlink/i);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(createMarkdownFeedbackSubmissionBackend({ directory: join(root, "plain") }).submit(command, {
    ...context, signal: controller.signal,
  }));
  assert.deepEqual(await readdir(root), ["linked"]);
});


test("Markdown backend stores dogfood feedback in Git-ignored docs directories", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "emseepea-feedback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkout = join(root, "checkout");
  await fs.mkdir(checkout);
  assert.equal(spawnSync("git", ["init", "-q", checkout]).status, 0);
  await symlink(checkout, join(root, "checkout-link"));
  const context = { scope: "tenant", signal: new AbortController().signal, deadlineMs: Date.now() + 10_000 };
  const command = { observation: "friction", detail: "Private detail", context: undefined };

  for (const directory of [join(checkout, "docs", "feedback"), join(root, "checkout-link", "docs", "feedback")]) {
    const result = await createMarkdownFeedbackSubmissionBackend({ directory }).submit(command, context);
    assert.equal(await readFile(join(directory, ".gitignore"), "utf8"), "/*\n!/.gitignore\n");
    const [scope] = (await readdir(directory)).filter((name) => name !== ".gitignore");
    assert.match(await readFile(join(directory, scope, `${result.id}.md`), "utf8"), /Private detail/);
    assert.equal(spawnSync("git", ["-C", checkout, "check-ignore", "-q", `docs/feedback/${scope}/${result.id}.md`]).status, 0);
    assert.equal(spawnSync("git", ["-C", checkout, "check-ignore", "-q", "docs/feedback/.gitignore"]).status, 1);
  }
});

test("Markdown backend requires a dedicated Git directory with a safe ignore rule", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "emseepea-feedback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkout = join(root, "checkout");
  await fs.mkdir(join(checkout, ".git"), { recursive: true });
  const docs = join(checkout, "docs");
  await fs.mkdir(docs);
  await fs.writeFile(join(docs, "guide.md"), "Keep this guide visible to Git.");
  const context = { scope: "tenant", signal: new AbortController().signal, deadlineMs: Date.now() + 10_000 };
  const command = { observation: "friction", detail: "Private detail", context: undefined };

  await assert.rejects(createMarkdownFeedbackSubmissionBackend({ directory: docs }).submit(command, context), /dedicated/i);
  await assert.rejects(fs.stat(join(docs, ".gitignore")), { code: "ENOENT" });
  const destination = join(docs, "feedback");
  await fs.mkdir(destination);
  await fs.writeFile(join(destination, ".gitignore"), "guide.md\n");
  await assert.rejects(createMarkdownFeedbackSubmissionBackend({ directory: destination }).submit(command, context), /ignore/i);
  assert.deepEqual(await readdir(destination), [".gitignore"]);
});

test("a receipt waits for the containing directory to sync", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "emseepea-feedback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalOpen = fs.open;
  const openMock = mock.method(fs, "open", async (...args) => {
    const handle = await originalOpen(...args);
    if ((args[1] & constants.O_DIRECTORY) !== 0) {
      mock.method(handle, "sync", async () => { throw new Error("directory sync failed"); });
    }
    return handle;
  });
  t.after(() => openMock.mock.restore());
  const backend = createMarkdownFeedbackSubmissionBackend({ directory: join(root, "docs") });
  await assert.rejects(backend.submit({ observation: "friction", detail: "Delayed", context: undefined }, {
    scope: "tenant", signal: new AbortController().signal, deadlineMs: Date.now() + 10_000,
  }), /directory sync failed/);
});

test("cancellation during a temporary write does not commit feedback", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "emseepea-feedback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const controller = new AbortController();
  const originalOpen = fs.open;
  const openMock = mock.method(fs, "open", async (...args) => {
    const handle = await originalOpen(...args);
    if (String(args[0]).endsWith(".tmp")) {
      const originalWriteFile = handle.writeFile.bind(handle);
      mock.method(handle, "writeFile", async (...writeArgs) => {
        controller.abort();
        return originalWriteFile(...writeArgs);
      });
    }
    return handle;
  });
  t.after(() => openMock.mock.restore());
  const directory = join(root, "docs");
  const backend = createMarkdownFeedbackSubmissionBackend({ directory });
  await assert.rejects(backend.submit({ observation: "friction", detail: "Delayed", context: undefined }, {
    scope: "tenant", signal: controller.signal, deadlineMs: Date.now() + 10_000,
  }));
  const [scope] = await readdir(directory);
  assert.deepEqual(await readdir(join(directory, scope)), []);
});
