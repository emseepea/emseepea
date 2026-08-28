import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const methods = new Set(["tools/call", "resources/read", "prompts/get"]);

export async function loadSemanticCase(path) {
  const absolutePath = path instanceof URL ? fileURLToPath(path) : resolve(path);
  const value = parseCase(await readFile(absolutePath, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("must be an object");
  for (const key of ["description", "question", "criteria", "server"]) {
    if (typeof value[key] !== "string" || value[key].trim() === "") fail(`${key} must be text`);
  }
  if (!Array.isArray(value.criticalFacts) || value.criticalFacts.some((fact) => typeof fact !== "string" || !fact)) {
    fail("criticalFacts must be a non-empty text list");
  }
  if (!Array.isArray(value.operations) || value.operations.length === 0) fail("operations must not be empty");
  for (const operation of value.operations) {
    if (!operation || typeof operation !== "object" || !methods.has(operation.method)) {
      fail("each operation needs a supported method");
    }
    const target = operation.name ?? operation.uri;
    if (typeof target !== "string" || target === "") fail("each operation needs a name or uri");
  }
  if (value.environment !== undefined && (!value.environment || typeof value.environment !== "object" || Array.isArray(value.environment))) {
    fail("environment must be an object");
  }
  if (value.authTokenEnvironment !== undefined && typeof value.authTokenEnvironment !== "string") {
    fail("authTokenEnvironment must be text");
  }
  if (value.authToken !== undefined && typeof value.authToken !== "string") fail("authToken must be text");
  return {
    ...value,
    path: absolutePath,
    directory: dirname(absolutePath),
    server: resolve(dirname(absolutePath), value.server),
  };
}

export function requiredPaths(testCase) {
  return testCase.operations.map((operation) => (
    `${operation.method}:${operation.name ?? operation.uri}`
  ));
}

function fail(message) {
  throw new Error(`Invalid semantic case: ${message}`);
}

function parseCase(source) {
  const lines = source.split(/\r?\n/);
  const value = {};
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    const top = /^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/.exec(line);
    if (!top) fail(`unsupported line: ${line}`);
    const [, key, raw = ""] = top;
    const rest = raw.trimEnd();
    if (key === "operations") {
      const parsed = parseOperations(lines, index + 1);
      value.operations = parsed.value;
      index = parsed.next;
    } else if (rest === ">-") {
      const parsed = parseFoldedText(lines, index + 1);
      value[key] = parsed.value;
      index = parsed.next;
    } else if (key === "environment" && rest === "") {
      const parsed = parseObject(lines, index + 1, "  ");
      value.environment = parsed.value;
      index = parsed.next;
    } else if (rest === "") {
      const parsed = parseList(lines, index + 1);
      value[key] = parsed.value;
      index = parsed.next;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      value[key] = rest.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean);
      index += 1;
    } else {
      value[key] = unquote(rest);
      index += 1;
    }
  }
  return value;
}

function parseOperations(lines, start) {
  const operations = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (!line.startsWith("  - ")) break;
    const operation = {};
    const first = line.slice(4);
    applyPair(operation, first);
    index += 1;
    while (index < lines.length) {
      const current = lines[index];
      if (current.trim() === "") {
        index += 1;
        continue;
      }
      if (current.startsWith("  - ") || !current.startsWith("    ")) break;
      const pair = /^    ([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/.exec(current);
      if (!pair) fail(`unsupported operation line: ${current}`);
      const [, key, raw = ""] = pair;
      if (key === "arguments" && raw.trimEnd() === "") {
        const parsed = parseObject(lines, index + 1, "      ");
        operation.arguments = parsed.value;
        index = parsed.next;
      } else {
        operation[key] = unquote(raw.trimEnd());
        index += 1;
      }
    }
    operations.push(operation);
  }
  return { value: operations, next: index };
}

function parseList(lines, start) {
  const items = [];
  let index = start;
  while (index < lines.length) {
    const item = /^  -\s+(.+)$/.exec(lines[index]);
    if (!item) break;
    items.push(unquote(item[1].trimEnd()));
    index += 1;
  }
  if (items.length === 0) fail("expected a list");
  return { value: items, next: index };
}

function parseObject(lines, start, indent) {
  const object = {};
  let index = start;
  while (index < lines.length) {
    if (!lines[index].startsWith(indent)) break;
    applyPair(object, lines[index].slice(indent.length));
    index += 1;
  }
  return { value: object, next: index };
}

function parseFoldedText(lines, start) {
  const parts = [];
  let index = start;
  while (index < lines.length) {
    if (!lines[index].startsWith("  ")) break;
    parts.push(lines[index].trim());
    index += 1;
  }
  return { value: parts.join(" "), next: index };
}

function applyPair(target, source) {
  const pair = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(source);
  if (!pair) fail(`expected key-value pair: ${source}`);
  target[pair[1]] = unquote(pair[2].trimEnd());
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
