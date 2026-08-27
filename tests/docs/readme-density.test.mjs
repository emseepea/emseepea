import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const maxParagraphCharacters = 400;

test("the root README has no wall-of-text prose paragraphs", async () => {
  const markdown = await readFile(new URL("../../README.md", import.meta.url), "utf8");
  const paragraphs = proseParagraphs(markdown);
  const dense = paragraphs.filter(({ text }) => text.length > maxParagraphCharacters);

  assert.deepEqual(
    dense.map(({ line, text }) => ({ line, characters: text.length, preview: text.slice(0, 80) })),
    [],
    `README prose paragraphs must stay within ${maxParagraphCharacters} characters`,
  );
});

test("the density guard measures prose and ignores non-prose structures", () => {
  const dense = "word ".repeat(90).trim();
  const markdown = [
    "# Heading",
    "",
    `- ${dense}`,
    "",
    "```text",
    dense,
    "```",
    "",
    `| ${dense} |`,
    "| --- |",
    "",
    `[reference]: https://example.com/${dense}`,
    "",
    dense,
    "",
    `> ${dense}`,
  ].join("\n");

  assert.deepEqual(proseParagraphs(markdown), [
    { line: 14, text: dense },
    { line: 16, text: dense },
  ]);
  assert.ok(dense.length > maxParagraphCharacters);
});

function proseParagraphs(markdown) {
  const paragraphs = [];
  let current = [];
  let startLine = 0;
  let inFence = false;
  let paragraphType;

  const flush = () => {
    if (current.length === 0) return;
    paragraphs.push({ line: startLine, text: current.join(" ").replaceAll(/\s+/g, " ").trim() });
    current = [];
    paragraphType = undefined;
  };

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (line.trimStart().startsWith("```")) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence || line.trim() === "") {
      flush();
      continue;
    }
    const trimmed = line.trimStart();
    if (/^(#{1,6} |[-*+] |\d+\. |\||\[[^\]]+\]:)/.test(trimmed)) {
      flush();
      continue;
    }
    const type = trimmed.startsWith(">") ? "blockquote" : "ordinary";
    if (current.length > 0 && type !== paragraphType) flush();
    if (current.length === 0) startLine = index + 1;
    paragraphType = type;
    current.push(type === "blockquote" ? trimmed.replace(/^>+\s?/, "") : line.trim());
  }
  flush();
  return paragraphs;
}
