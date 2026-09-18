import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type JsonObject = Readonly<Record<string, unknown>>;

export interface PublishedMcpResource extends JsonObject {
  readonly uri: string;
  readonly contents: readonly JsonObject[];
}

export interface PublishedMcpContract {
  readonly tools: readonly JsonObject[];
  readonly resources: readonly PublishedMcpResource[];
}

export interface PublishedMcpContractBaseline {
  readonly version: string;
  readonly contract: PublishedMcpContract;
}

export interface PublishedMcpContractBreak {
  readonly version: string;
  readonly kind: string;
  readonly path: string;
  readonly detail: string;
}

export interface PublishedMcpContractBaselineInput {
  readonly file: string;
  readonly value: unknown;
}

export interface PublishedMcpContractCheckPolicyInput {
  readonly current: PublishedMcpContract;
  readonly baselines: readonly PublishedMcpContractBaselineInput[];
}

export type PublishedMcpContractCheckPolicy = (
  input: PublishedMcpContractCheckPolicyInput,
) => readonly PublishedMcpContractBreak[] | Promise<readonly PublishedMcpContractBreak[]>;

export interface PublishedMcpContractClient {
  listTools(params?: { cursor?: string }): Promise<{ tools: unknown[]; nextCursor?: string }>;
  listResources(params?: { cursor?: string }): Promise<{ resources: unknown[]; nextCursor?: string }>;
  readResource(params: { uri: string }): Promise<{ contents: unknown[] }>;
}

/** Extracts the effective public contract visible to the connected MCP principal. */
export async function extractPublishedMcpContract(
  client: PublishedMcpContractClient,
): Promise<PublishedMcpContract> {
  const tools = await collectPages("tools", (cursor) => client.listTools(cursor ? { cursor } : undefined));
  const listedResources = await collectPages(
    "resources",
    (cursor) => client.listResources(cursor ? { cursor } : undefined),
  );
  const resources = await Promise.all(listedResources.map(async (resource) => {
    if (typeof resource.uri !== "string") throw new TypeError("Listed resource has no URI");
    const read = await client.readResource({ uri: resource.uri });
    const contents = read.contents.map((content) => {
      if (!isObject(content)) throw new TypeError(`Resource ${resource.uri} returned invalid content`);
      const { uri, mimeType, _meta } = content;
      return { uri, mimeType, _meta };
    });
    return {
      ...resource,
      contents,
    };
  }));
  return canonicalize({
    tools: tools.toSorted(compareBy("name")),
    resources: resources.toSorted(compareBy("uri")),
  }) as unknown as PublishedMcpContract;
}

/** Writes a byte-stable, version-labelled baseline. */
export async function writePublishedMcpContractBaseline(
  file: string,
  baseline: PublishedMcpContractBaseline,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(canonicalize(baseline), null, 2)}\n`);
}

/** Returns every breaking or unclassified change against every supplied baseline. */
export function comparePublishedMcpContracts(
  current: PublishedMcpContract,
  baselines: readonly [PublishedMcpContractBaseline, ...PublishedMcpContractBaseline[]],
): PublishedMcpContractBreak[] {
  if (baselines.length === 0) throw new TypeError("At least one published MCP contract baseline is required");
  return baselines.flatMap(({ version, contract }) => compareContract(version, contract, current));
}

/** Throws with concrete diagnostics so an ordinary Node script exits non-zero. */
export function assertPublishedMcpContractCompatible(
  current: PublishedMcpContract,
  baselines: readonly [PublishedMcpContractBaseline, ...PublishedMcpContractBaseline[]],
): void {
  const breaks = comparePublishedMcpContracts(current, baselines);
  if (breaks.length === 0) return;
  throw new Error([
    `Published MCP contract has ${breaks.length} breaking change(s):`,
    ...breaks.map(({ version, kind, path, detail }) => `- [${version}] [${kind}] ${path}: ${detail}`),
  ].join("\n"));
}

async function collectPages<Key extends "tools" | "resources">(
  key: Key,
  list: (cursor?: string) => Promise<Record<Key, unknown[]> & { nextCursor?: string }>,
): Promise<JsonObject[]> {
  const values: JsonObject[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await list(cursor);
    for (const value of page[key]) {
      if (!isObject(value)) throw new TypeError(`${key} discovery returned an invalid entry`);
      values.push(value);
    }
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error(`${key} pagination repeated cursor ${cursor}`);
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return values;
}

function compareContract(
  version: string,
  baseline: PublishedMcpContract,
  current: PublishedMcpContract,
): PublishedMcpContractBreak[] {
  const breaks: PublishedMcpContractBreak[] = [];
  const add = (kind: string, path: string, detail: string) => breaks.push({ version, kind, path, detail });
  for (const tool of baseline.tools) {
    const name = String(tool.name);
    const next = current.tools.find((candidate) => candidate.name === tool.name);
    if (!next) {
      add("tool-removed", `tools.${name}`, "tool is absent");
      continue;
    }
    compareSchema(tool.inputSchema, next.inputSchema, "input", `tools.${name}.inputSchema`, add);
    compareSchema(tool.outputSchema, next.outputSchema, "output", `tools.${name}.outputSchema`, add);
    compareUiMetadata(tool._meta, next._meta, `tools.${name}._meta`, add);
    comparePublicFields(tool, next, new Set(["name", "inputSchema", "outputSchema", "_meta"]), `tools.${name}`, add);
  }
  for (const resource of baseline.resources) {
    const next = current.resources.find((candidate) => candidate.uri === resource.uri);
    if (!next) {
      add("resource-removed", `resources.${resource.uri}`, "resource is absent");
      continue;
    }
    if (resource.mimeType !== next.mimeType) {
      add("mime-type-changed", `resources.${resource.uri}.mimeType`, `${show(resource.mimeType)} -> ${show(next.mimeType)}`);
    }
    compareUiMetadata(resource._meta, next._meta, `resources.${resource.uri}._meta`, add);
    comparePublicFields(resource, next, new Set(["uri", "mimeType", "_meta", "contents"]), `resources.${resource.uri}`, add);
    for (const [index, content] of resource.contents.entries()) {
      const nextContent = next.contents[index];
      const path = `resources.${resource.uri}.contents[${index}]`;
      if (!nextContent) {
        add("resource-content-removed", path, "content is absent");
        continue;
      }
      if (content.uri !== nextContent.uri) {
        add("resource-uri-changed", `${path}.uri`, `${show(content.uri)} -> ${show(nextContent.uri)}`);
      }
      if (content.mimeType !== nextContent.mimeType) {
        add("mime-type-changed", `${path}.mimeType`, `${show(content.mimeType)} -> ${show(nextContent.mimeType)}`);
      }
      compareUiMetadata(content._meta, nextContent._meta, `${path}._meta`, add);
    }
  }
  return breaks;
}

function comparePublicFields(
  before: JsonObject,
  after: JsonObject,
  ignored: ReadonlySet<string>,
  path: string,
  add: AddBreak,
): void {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!ignored.has(key) && !equal(before[key], after[key])) {
      add("contract-field-changed", `${path}.${key}`, `${show(before[key])} -> ${show(after[key])}`);
    }
  }
}

type Direction = "input" | "output";
type AddBreak = (kind: string, path: string, detail: string) => void;

function compareSchema(
  baselineValue: unknown,
  currentValue: unknown,
  direction: Direction,
  path: string,
  add: AddBreak,
): void {
  if (baselineValue === undefined) return;
  if (!isObject(baselineValue) || !isObject(currentValue)) {
    if (!equal(baselineValue, currentValue)) add("schema-changed", path, `${show(baselineValue)} -> ${show(currentValue)}`);
    return;
  }
  const baseline = baselineValue;
  const current = currentValue;
  compareSetConstraint("type", baseline.type, current.type, direction, path, add);
  compareSetConstraint("enum", baseline.enum, current.enum, direction, path, add);
  compareSetConstraint("const", baseline.const === undefined ? undefined : [baseline.const], current.const === undefined ? undefined : [current.const], direction, path, add);
  compareBounds(baseline, current, direction, path, add);
  comparePattern(baseline.pattern, current.pattern, direction, path, add);
  compareMultipleOf(baseline.multipleOf, current.multipleOf, direction, path, add);
  compareBooleanConstraint("uniqueItems", baseline.uniqueItems, current.uniqueItems, direction, path, add);
  compareAdditionalProperties(baseline.additionalProperties, current.additionalProperties, direction, path, add);

  const baselineProperties = isObject(baseline.properties) ? baseline.properties : {};
  const currentProperties = isObject(current.properties) ? current.properties : {};
  for (const [name, schema] of Object.entries(baselineProperties)) {
    if (!(name in currentProperties)) add("field-removed", `${path}.properties.${name}`, "field is absent");
    else compareSchema(schema, currentProperties[name], direction, `${path}.properties.${name}`, add);
  }
  if (direction === "output" && baseline.additionalProperties === false) {
    for (const name of Object.keys(currentProperties)) {
      if (!(name in baselineProperties)) add("output-field-added", `${path}.properties.${name}`, "baseline rejects this field");
    }
  }
  const baselineRequired = stringSet(baseline.required);
  const currentRequired = stringSet(current.required);
  const newlyIncompatible = direction === "input"
    ? [...currentRequired].filter((name) => !baselineRequired.has(name))
    : [...baselineRequired].filter((name) => !currentRequired.has(name));
  for (const name of newlyIncompatible) {
    add(direction === "input" ? "input-field-now-required" : "output-field-now-optional", `${path}.properties.${name}`, "required fields changed incompatibly");
  }
  if (baseline.items !== undefined) compareSchema(baseline.items, current.items, direction, `${path}.items`, add);

  const handled = new Set([
    "$schema", "$id", "$comment", "title", "description", "default", "examples", "deprecated", "readOnly", "writeOnly",
    "type", "enum", "const", "minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum", "minLength", "maxLength",
    "minItems", "maxItems", "minProperties", "maxProperties", "pattern", "multipleOf", "uniqueItems", "additionalProperties",
    "properties", "required", "items",
  ]);
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (!handled.has(key) && !equal(baseline[key], current[key])) {
      add("unclassified-schema-change", `${path}.${key}`, `${show(baseline[key])} -> ${show(current[key])}`);
    }
  }
}

function compareSetConstraint(
  name: string,
  baselineValue: unknown,
  currentValue: unknown,
  direction: Direction,
  path: string,
  add: AddBreak,
): void {
  if (baselineValue === undefined && currentValue === undefined) return;
  if ((direction === "input" && baselineValue === undefined)
    || (direction === "output" && currentValue === undefined)) {
    add(`${direction}-${name}-changed`, `${path}.${name}`, `${show(baselineValue)} -> ${show(currentValue)}`);
    return;
  }
  if ((direction === "input" && currentValue === undefined)
    || (direction === "output" && baselineValue === undefined)) return;
  const baseline = valueSet(baselineValue);
  const current = valueSet(currentValue);
  const required = direction === "input" ? baseline : current;
  const available = direction === "input" ? current : baseline;
  if (required && (!available || [...required].some((value) => !available.has(value)))) {
    add(`${direction}-${name}-changed`, `${path}.${name}`, `${show(baselineValue)} -> ${show(currentValue)}`);
  }
}

function compareBounds(
  baseline: JsonObject,
  current: JsonObject,
  direction: Direction,
  path: string,
  add: AddBreak,
): void {
  for (const [key, lower] of [
    ["minimum", true], ["exclusiveMinimum", true], ["minLength", true], ["minItems", true], ["minProperties", true],
    ["maximum", false], ["exclusiveMaximum", false], ["maxLength", false], ["maxItems", false], ["maxProperties", false],
  ] as const) {
    const before = typeof baseline[key] === "number" ? baseline[key] : undefined;
    const after = typeof current[key] === "number" ? current[key] : undefined;
    const tighter = lower
      ? after !== undefined && (before === undefined || after > before)
      : after !== undefined && (before === undefined || after < before);
    const wider = lower
      ? before !== undefined && (after === undefined || after < before)
      : before !== undefined && (after === undefined || after > before);
    if ((direction === "input" && tighter) || (direction === "output" && wider)) {
      add(`${direction}-constraint-changed`, `${path}.${key}`, `${show(before)} -> ${show(after)}`);
    }
  }
}

function comparePattern(before: unknown, after: unknown, direction: Direction, path: string, add: AddBreak): void {
  if (before === after) return;
  if ((direction === "input" && after !== undefined) || (direction === "output" && before !== undefined)) {
    add(`${direction}-pattern-changed`, `${path}.pattern`, `${show(before)} -> ${show(after)}`);
  }
}

function compareMultipleOf(before: unknown, after: unknown, direction: Direction, path: string, add: AddBreak): void {
  if (before === after) return;
  const beforeNumber = typeof before === "number" && before > 0 ? before : undefined;
  const afterNumber = typeof after === "number" && after > 0 ? after : undefined;
  const compatible = direction === "input"
    ? afterNumber === undefined || (beforeNumber !== undefined && isIntegerRatio(beforeNumber, afterNumber))
    : beforeNumber === undefined || (afterNumber !== undefined && isIntegerRatio(afterNumber, beforeNumber));
  if (!compatible) add(`${direction}-multiple-of-changed`, `${path}.multipleOf`, `${show(before)} -> ${show(after)}`);
}

function compareBooleanConstraint(name: string, before: unknown, after: unknown, direction: Direction, path: string, add: AddBreak): void {
  const incompatible = direction === "input" ? before !== true && after === true : before === true && after !== true;
  if (incompatible) add(`${direction}-${name}-changed`, `${path}.${name}`, `${show(before)} -> ${show(after)}`);
}

function compareAdditionalProperties(before: unknown, after: unknown, direction: Direction, path: string, add: AddBreak): void {
  if (equal(before, after)) return;
  const beforeAllows = before !== false;
  const afterAllows = after !== false;
  const incompatible = direction === "input" ? beforeAllows && !afterAllows : !beforeAllows && afterAllows;
  if (incompatible) add(`${direction}-additional-properties-changed`, `${path}.additionalProperties`, `${show(before)} -> ${show(after)}`);
  else if (isObject(before) || isObject(after)) add("unclassified-schema-change", `${path}.additionalProperties`, `${show(before)} -> ${show(after)}`);
}

function compareUiMetadata(beforeValue: unknown, afterValue: unknown, path: string, add: AddBreak): void {
  const before = isObject(beforeValue) ? beforeValue : {};
  const after = isObject(afterValue) ? afterValue : {};
  const beforeUi = isObject(before.ui) ? before.ui : {};
  const afterUi = isObject(after.ui) ? after.ui : {};
  const beforeContract = {
    ...before,
    ui: { ...beforeUi, csp: undefined },
    "openai/outputTemplate": undefined,
    "openai/widgetCSP": undefined,
  };
  const afterContract = {
    ...after,
    ui: { ...afterUi, csp: undefined },
    "openai/outputTemplate": undefined,
    "openai/widgetCSP": undefined,
  };
  if (!equal(beforeContract, afterContract)) add("ui-metadata-changed", path, `${show(beforeContract)} -> ${show(afterContract)}`);
  if (before["openai/outputTemplate"] !== after["openai/outputTemplate"]) {
    add("output-template-changed", `${path}.openai/outputTemplate`, `${show(before["openai/outputTemplate"])} -> ${show(after["openai/outputTemplate"])}`);
  }
  compareCsp(beforeUi.csp, afterUi.csp, `${path}.ui.csp`, add);
  compareCsp(before["openai/widgetCSP"], after["openai/widgetCSP"], `${path}.openai/widgetCSP`, add);
}

function compareCsp(beforeValue: unknown, afterValue: unknown, path: string, add: AddBreak): void {
  const before = isObject(beforeValue) ? beforeValue : {};
  const after = isObject(afterValue) ? afterValue : {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const allowed = valueSet(before[key]) ?? new Set<string>();
    for (const value of valueSet(after[key]) ?? []) {
      if (!allowed.has(value)) add("csp-widened", `${path}.${key}`, `${String(value)} was added`);
    }
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
}

function compareBy(key: string): (left: JsonObject, right: JsonObject) => number {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function valueSet(value: unknown): Set<unknown> | undefined {
  if (value === undefined) return undefined;
  return new Set(Array.isArray(value) ? value.map(show) : [show(value)]);
}

function stringSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
}

function isIntegerRatio(left: number, right: number): boolean {
  return Math.abs(left / right - Math.round(left / right)) < Number.EPSILON * 10;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  return show(canonicalize(left)) === show(canonicalize(right));
}

function show(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
