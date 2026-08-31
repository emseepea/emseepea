import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const maxParagraphCharacters = 400;

test("public READMEs and website guides have no wall-of-text prose paragraphs", async () => {
  const readmes = [{ label: "README.md", url: new URL("../../README.md", import.meta.url) }];
  for (const group of ["examples", "packages"]) {
    const root = new URL(`../../${group}/`, import.meta.url);
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const url = new URL(`${entry.name}/README.md`, root);
      try {
        await readFile(url, "utf8");
        readmes.push({ label: `${group}/${entry.name}/README.md`, url });
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  const contentRoot = new URL("../../website/src/content/docs/", import.meta.url);
  for (const file of await readdir(contentRoot, { recursive: true })) {
    if (/\.mdx?$/.test(file)) readmes.push({ label: `website/src/content/docs/${file}`, url: new URL(file, contentRoot) });
  }

  const dense = [];
  for (const readme of readmes) {
    const markdown = await readFile(readme.url, "utf8");
    dense.push(...proseParagraphs(markdown)
      .filter(({ text }) => text.length > maxParagraphCharacters)
      .map(({ line, text }) => ({ file: readme.label, line, characters: text.length, preview: text.slice(0, 80) })));
  }

  assert.deepEqual(
    dense,
    [],
    `Public README prose paragraphs must stay within ${maxParagraphCharacters} characters`,
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
