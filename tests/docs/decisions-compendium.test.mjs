import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateCompendium } from "../../scripts/generate-decisions-compendium.mjs";

test("the decision compendium keeps complete decisions and relationships", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "emseepea-decisions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await writeDecision(directory, "0002-new.proposed.md", {
    status: "proposed",
    title: "New Decision",
    supersedes: '["ADR-0001"]',
    chosen: [
      'Chosen option: **"Keep the full paragraph"**, because it includes',
      "wrapped `code` and a [useful link](https://example.com).",
    ],
    checks: ["The first check continues", "  onto another line.", "The second check passes."],
  });
  await writeDecision(directory, "0001-old.superseded.md", {
    status: "proposed",
    title: "Old Decision",
  });

  const result = await generateCompendium(directory);

  const details = result.slice(result.indexOf("## Decision Details"));
  assert.ok(details.indexOf("ADR-0001: Old Decision") < details.indexOf("ADR-0002: New Decision"));
  assert.match(result, /wrapped `code` and a \[useful link\]\(https:\/\/example\.com\)\./);
  assert.match(result, /- The first check continues onto another line\./);
  assert.match(result, /- Replaces: \[ADR-0001: Old Decision\]\(0001-old\.superseded\.md\)/);
  assert.match(result, /- Replaced by: \[ADR-0002: New Decision\]\(0002-new\.proposed\.md\)/);
  assert.match(result, /### \[ADR-0001: Old Decision\][\s\S]*?- Status: Superseded/);
});

test("the generator rejects incomplete or contradictory decisions", async (t) => {
  const cases = [
    ["duplicate ID", ["0001-one.proposed.md", "0001-two.proposed.md"], /Duplicate decision ID/],
    ["missing check", ["0001-one.proposed.md"], /no Confirmation checks/, { checks: [] }],
    [
      "missing relationship",
      ["0001-one.proposed.md"],
      /refers to missing decision ADR-0009/,
      { supersedes: '["ADR-0009"]' },
    ],
  ];

  for (const [name, files, expected, options = {}] of cases) {
    await t.test(name, async (subtest) => {
      const directory = await mkdtemp(path.join(tmpdir(), "emseepea-decisions-"));
      subtest.after(() => rm(directory, { recursive: true, force: true }));
      for (const file of files) await writeDecision(directory, file, options);
      await assert.rejects(generateCompendium(directory), expected);
    });
  }
});

test("the committed decision compendium is current", async () => {
  const directoryUrl = new URL("../../docs/decisions/", import.meta.url);
  const directory = fileURLToPath(directoryUrl);
  const [expected, current] = await Promise.all([
    generateCompendium(directory),
    readFile(new URL("README.md", directoryUrl), "utf8"),
  ]);
  assert.equal(current, expected, "run npm run decisions:generate");
});

async function writeDecision(directory, filename, options = {}) {
  const {
    status = filename.match(/\.([^.]+)\.md$/)?.[1] ?? "proposed",
    title = "A Decision",
    chosen = ['Chosen option: **"A complete choice"**, because it is testable.'],
    checks = ["A complete check passes."],
    supersedes,
  } = options;

  const frontmatter = [
    "---",
    `status: "${status}"`,
    "human-oversight: confirmed",
    ...(supersedes ? [`supersedes: ${supersedes}`] : []),
    "---",
  ];
  const markdown = [
    ...frontmatter,
    "",
    `# ${title}`,
    "",
    "## Decision Outcome",
    "",
    ...chosen,
    "",
    "## Confirmation",
    "",
    ...checks.map((line) => (line.startsWith("  ") ? line : `- ${line}`)),
    "",
  ].join("\n");

  await writeFile(path.join(directory, filename), markdown);
}
