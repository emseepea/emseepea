import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

test("defineTool type-checks a large Zod output schema within a bounded heap", async () => {
  const directory = await mkdtemp(join(tmpdir(), "emseepea-large-schema-"));
  try {
    const optionalRecords = Array.from(
      { length: 100 },
      (_, index) => `record${String(index).padStart(2, "0")}: record.optional(),`,
    ).join("\n");
    const source = `
import { defineTool } from ${JSON.stringify(join(root, "packages/framework/src/index.js"))};
import { z } from ${JSON.stringify(join(root, "node_modules/zod/index.js"))};

const record = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  enabled: z.boolean(),
  count: z.number(),
  total: z.number(),
  status: z.enum(["ready", "pending", "failed"]),
  tags: z.array(z.string()),
  owner: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  address: z.object({ line1: z.string(), city: z.string(), postcode: z.string() }),
  metadata: z.record(z.string(), z.string()),
  children: z.array(z.object({ id: z.string(), label: z.string(), value: z.number() })),
});

const outputSchema = z.object({
  summary: z.string(),
  ${optionalRecords}
});

defineTool({
  name: "large-schema",
  access: "public",
  description: "Large schema compile-time regression.",
  inputSchema: z.object({ query: z.string() }),
  outputSchema,
  handler: ({ query }) => ({ text: query, data: { summary: query } }),
});
`;
    await writeFile(join(directory, "repro.ts"), source);
    await writeFile(join(directory, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: "ES2024",
      },
      files: ["repro.ts"],
    }));

    const result = spawnSync(
      process.execPath,
      ["--max-old-space-size=512", join(root, "node_modules/typescript/bin/tsc"), "-p", join(directory, "tsconfig.json")],
      { encoding: "utf8", timeout: 30_000 },
    );

    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
