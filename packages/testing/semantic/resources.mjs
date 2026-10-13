import { ReadResourceResultSchema } from "@modelcontextprotocol/core";
import { ResourceTemplate } from "@modelcontextprotocol/server";

export const nativeResourceHelpers = new Set([
  "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource",
]);
const server = "emseepea_eval";
const limit = 1_048_576;

// The inventory is obtained with the same authentication as the conversation.
// It bounds provider-reported helpers; it is not independent HTTP-hop evidence.
export async function collectResourceCatalogue(client, signal) {
  signal?.throwIfAborted();
  if (!client.getServerCapabilities()?.resources) return { resources: [], resourceTemplates: [] };
  const collect = async (method, key) => {
    const entries = [];
    const cursors = new Set();
    let cursor;
    let bytes = 0;
    for (let page = 0; page < 32; page += 1) {
      signal?.throwIfAborted();
      const response = await client[method](cursor === undefined ? {} : { cursor }, { signal });
      bytes += Buffer.byteLength(JSON.stringify(response));
      if (bytes > limit || !Array.isArray(response[key])) throw new Error("Resource catalogue exceeds its bounds");
      entries.push(...response[key]);
      if (entries.length > 4096) throw new Error("Resource catalogue exceeds its bounds");
      if (response.nextCursor === undefined) return entries;
      if (typeof response.nextCursor !== "string" || !response.nextCursor || cursors.has(response.nextCursor)) {
        throw new Error("Resource catalogue returned an invalid cursor");
      }
      cursors.add(response.nextCursor);
      cursor = response.nextCursor;
    }
    throw new Error("Resource catalogue exceeds its page bound");
  };
  const resources = await collect("listResources", "resources");
  const resourceTemplates = await collect("listResourceTemplates", "resourceTemplates");
  if (resources.some((entry) => typeof entry.uri !== "string")
    || resourceTemplates.some((entry) => typeof entry.uriTemplate !== "string")) {
    throw new Error("Resource catalogue contains invalid entries");
  }
  for (const entry of resourceTemplates) new ResourceTemplate(entry.uriTemplate, { list: undefined });
  return { resources, resourceTemplates };
}

export function assertResourceHelperCollisions(tools) {
  if (tools.some(({ name }) => nativeResourceHelpers.has(name))) {
    throw new Error("Native resource helpers collide with an advertised tool");
  }
}

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));

export function resourceHelperOperation(item, catalogue) {
  if (!catalogue || !nativeResourceHelpers.has(item.tool)) return undefined;
  if (![server, "codex"].includes(item.server) || item.status !== "completed"
    || !object(item.arguments) || !keys(item.arguments, ["server", "uri"])) return undefined;
  const reading = item.tool === "read_mcp_resource";
  if (reading && (item.arguments.server !== server || typeof item.arguments.uri !== "string")) return undefined;
  if (!reading && (item.arguments.uri !== undefined
    || (item.arguments.server !== undefined && item.arguments.server !== server))) return undefined;
  if (!object(item.result) || !keys(item.result, ["content", "structured_content"])
    || item.result.structured_content !== null || !Array.isArray(item.result.content)
    || item.result.content.length !== 1) return undefined;
  const [content] = item.result.content;
  if (!object(content) || content.type !== "text" || typeof content.text !== "string"
    || !keys(content, ["type", "text"]) || Buffer.byteLength(content.text) > limit) return undefined;
  let result;
  try { result = JSON.parse(content.text); } catch { return undefined; }
  if (!object(result)) return undefined;
  if (reading) {
    const uri = item.arguments.uri;
    if (!keys(result, ["server", "uri", "contents"]) || result.server !== server || result.uri !== uri
      || !Array.isArray(result.contents) || !knownUri(uri, catalogue)
      || !ReadResourceResultSchema.safeParse({ contents: result.contents }).success
      || result.contents.some((entry) => !object(entry)
        || (typeof entry.text === "string") === (typeof entry.blob === "string"))) return undefined;
    // Aggregate reads may return distinct content URIs. They are content from
    // this registered request, not new catalogue entries or follow-up authority.
    return { method: "resources/read", target: uri, arguments: item.arguments, result };
  }
  const key = item.tool === "list_mcp_resources" ? "resources" : "resourceTemplates";
  const field = key === "resources" ? "uri" : "uriTemplate";
  if (!keys(result, ["server", key]) || (result.server !== undefined && result.server !== server)
    || !Array.isArray(result[key])) return undefined;
  if (item.server === "codex" && item.arguments.server === undefined
    && result.server === undefined && result[key].length === 0) return undefined;
  if (result[key].some((entry) => !object(entry) || entry.server !== server
    || !catalogue[key].some((known) => known[field] === entry[field]))) return undefined;
  return { method: key === "resources" ? "resources/list" : "resources/templates/list",
    target: server, arguments: item.arguments, result };
}

function knownUri(uri, catalogue) {
  return catalogue.resources.some((entry) => entry.uri === uri)
    || catalogue.resourceTemplates.some((entry) => new ResourceTemplate(entry.uriTemplate, { list: undefined }).uriTemplate.match(uri) !== null);
}
