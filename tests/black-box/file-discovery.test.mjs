import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createEmseepea, discoverCapabilities, serveEmseepea } from "@emseepea/server";

const serverUrl = pathToFileURL(resolve("packages/framework/dist/index.js")).href;
const zodUrl = pathToFileURL(resolve("node_modules/zod/index.js")).href;
const requestMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "discovery-test", version: "0.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("filesystem discovery is deterministic and uses the checked tool boundary", async () => {
  const directory = await temporaryDirectory();
  const calls = [];
  await Promise.all([
    writeFile(join(directory.path, "tool.zeta.mjs"), toolModule("zeta")),
    writeFile(join(directory.path, "tool.alpha.ts"), toolModule("alpha")),
    writeFile(join(directory.path, "tool.ignored.test.mjs"), "throw new Error('must not load');\n"),
    writeFile(join(directory.path, "tool.ignored.d.ts"), "export default never;\n"),
    writeFile(join(directory.path, "tool.ignored.js.map"), "{}\n"),
  ]);

  try {
    const first = await discoverCapabilities(pathToFileURL(`${directory.path}/`), { calls });
    const second = await discoverCapabilities(pathToFileURL(`${directory.path}/`), { calls });
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.tools), true);
    assert.equal(first.tools.length, 2);
    assert.equal(second.tools.length, 2);

    const running = await serveEmseepea(createEmseepea({
      name: "discovered-server",
      version: "0.0.0",
      ...first,
    }), { port: 0 });
    const repeated = await serveEmseepea(createEmseepea({
      name: "discovered-server",
      version: "0.0.0",
      ...second,
    }), { port: 0 });
    try {
      const listed = await rpc(running.url, "tools/list");
      const relisted = await rpc(repeated.url, "tools/list");
      assert.deepEqual(listed.body.result.tools.map(({ name }) => name), ["alpha", "zeta"]);
      assert.deepEqual(relisted.body.result.tools.map(({ name }) => name), ["alpha", "zeta"]);
      assert.equal(JSON.stringify(relisted.body.result), JSON.stringify(listed.body.result));

      const invalidInput = await rpc(running.url, "tools/call", {
        name: "alpha",
        arguments: { missing: true },
      });
      assert.equal(invalidInput.body.result.isError, true);
      assert.deepEqual(calls, []);

      const valid = await rpc(running.url, "tools/call", {
        name: "alpha",
        arguments: { id: "valid" },
      });
      assert.equal(valid.body.result.isError, false);
      assert.deepEqual(calls, ["alpha:valid"]);

      const invalidOutput = await rpc(running.url, "tools/call", {
        name: "zeta",
        arguments: { id: "invalid-output" },
      });
      assert.equal(invalidOutput.body.result.isError, true);
      assert.deepEqual(calls, ["alpha:valid", "zeta:invalid-output"]);
      assert.doesNotMatch(JSON.stringify(invalidOutput.body), /wrong|stack|schema/i);
    } finally {
      await Promise.all([running.close(), repeated.close()]);
    }
  } finally {
    await directory.remove();
  }
});

test("filesystem discovery rejects malformed, conflicting, and unsafe modules", async (t) => {
  await t.test("malformed capability filename", async () => {
    await rejectsDirectory([["tool.bad name.mjs", toolModule("bad-name")]], /Malformed capability filename/);
  });
  await t.test("source and built output collision", async () => {
    await rejectsDirectory([
      ["tool.same.js", toolModule("same")],
      ["tool.same.ts", toolModule("same")],
    ], /Duplicate tool name/);
  });
  await t.test("missing declaration", async () => {
    await rejectsDirectory([
      ["tool.missing.mjs", "export default () => undefined;\n"],
    ], /does not match its filename/);
  });
  await t.test("additional module export", async () => {
    await rejectsDirectory([
      ["tool.extra.mjs", `${toolModule("extra")}\nexport const extra = true;\n`],
    ], /export only a default factory/);
  });
  await t.test("filename and declaration mismatch", async () => {
    await rejectsDirectory([["tool.expected.mjs", toolModule("actual")]], /does not match its filename/);
  });
  await t.test("module symlink", async () => {
    const directory = await temporaryDirectory();
    const outside = await temporaryDirectory();
    try {
      const target = join(outside.path, "tool.linked.mjs");
      await writeFile(target, toolModule("linked"));
      await symlink(target, join(directory.path, "tool.linked.mjs"));
      await assert.rejects(
        discoverCapabilities(pathToFileURL(`${directory.path}/`), { calls: [] }),
        /regular file/,
      );
    } finally {
      await Promise.all([directory.remove(), outside.remove()]);
    }
  });
  await t.test("non-file URL", async () => {
    await assert.rejects(discoverCapabilities(new URL("https://example.com/capabilities/")), /local file URL/);
  });
});

function toolModule(name) {
  return `
import { defineTool } from ${JSON.stringify(serverUrl)};
import { z } from ${JSON.stringify(zodUrl)};
export default ({ calls }) => defineTool({
  name: ${JSON.stringify(name)},
  access: "public",
  description: "Discovered test tool.",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ id: z.string() }),
  handler: ({ id }) => {
    calls.push(${JSON.stringify(name)} + ":" + id);
    return id === "invalid-output"
      ? { text: "must not escape", data: { wrong: true } }
      : { text: id, data: { id } };
  },
});
`;
}

async function rejectsDirectory(files, pattern) {
  const directory = await temporaryDirectory();
  try {
    await Promise.all(files.map(([name, source]) => writeFile(join(directory.path, name), source)));
    await assert.rejects(
      discoverCapabilities(pathToFileURL(`${directory.path}/`), { calls: [] }),
      pattern,
    );
  } finally {
    await directory.remove();
  }
}

async function temporaryDirectory() {
  const path = await mkdtemp(join(tmpdir(), "emseepea-discovery-"));
  await mkdir(path, { recursive: true });
  return { path, remove: () => rm(path, { recursive: true, force: true }) };
}

async function rpc(url, method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: { ...params, _meta: requestMeta },
    }),
  });
  return { response, body: await response.json() };
}
