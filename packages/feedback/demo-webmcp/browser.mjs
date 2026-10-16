import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { registerFeedbackWebMcp } from "@emseepea/feedback/webmcp";

const status = document.querySelector("#feedback-status");
const disable = document.querySelector("#disable-feedback");
let current;

// This application owns its client and restricts its endpoint to this origin.
// A deployed application must supply its own authenticated website integration.
export async function enableFeedback() {
  if (current) return;
  if (!document.modelContext) {
    status.textContent = "Agent feedback is unavailable in this browser. Variety search still works.";
    return;
  }
  const lifetime = new AbortController();
  const client = new Client({ name: "website-feedback-demo", version: "0.0.0" });
  current = { lifetime, client };
  try {
    const transport = new StreamableHTTPClientTransport(new URL("/mcp", location.origin), {
      fetch: (url, init) => fetch(url, {
        ...init, credentials: "same-origin",
        signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : [])]),
      }),
    });
    await client.connect(transport);
    const registration = await registerFeedbackWebMcp({ client, signal: lifetime.signal });
    if (!registration.available) throw new Error("WebMCP unavailable");
    if (lifetime.signal.aborted) return;
    current.registration = registration;
    status.textContent = "Agent feedback is ready. An agent can report notable observations and must tell you what it recorded.";
    disable.disabled = false;
  } catch {
    lifetime.abort();
    await client.close().catch(() => {});
    if (current?.client === client) current = undefined;
    status.textContent = "Agent feedback could not connect. Variety search still works.";
  }
}

export async function disableFeedback() {
  const previous = current;
  current = undefined;
  previous?.registration?.dispose();
  previous?.lifetime.abort();
  await previous?.client.close().catch(() => {});
  disable.disabled = true;
  status.textContent = "Agent feedback is disabled. Variety search still works.";
}

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#query");
const searchResults = document.querySelector("#search-results");
const varieties = ["Highland Snap", "Harbour Shelling", "Snowcap Snow Pea"];
const pageLifetime = new AbortController();

// Human form submissions and native agent calls share this exact application path.
function searchVarieties(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => key !== "query") ||
      typeof input.query !== "string" || input.query.length > 100 || !input.query.trim()) {
    throw new TypeError("Enter a search query between 1 and 100 characters.");
  }
  const query = input.query.trim().toLowerCase();
  const matches = varieties.filter((name) => name.toLowerCase().includes(query));
  const suggestedWord = query.split(/\s+/).find((word) =>
    word.length > 1 && varieties.some((name) => name.toLowerCase().includes(word)));
  const data = matches.length ? { matches } : {
    matches,
    interfaceNote: "Search uses exact words only. " + (suggestedWord
      ? `Try “${suggestedWord}”.` : "Try a shorter search."),
  };
  searchInput.setCustomValidity("");
  searchInput.value = input.query;
  searchResults.textContent = matches.length
    ? `Found: ${matches.join(", ")}.`
    : `No varieties found. ${data.interfaceNote}`;
  return data;
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchInput.setCustomValidity("");
  try {
    searchVarieties({ query: new FormData(searchForm).get("query") });
  } catch {
    searchInput.setCustomValidity("Enter a search query between 1 and 100 characters.");
    searchInput.reportValidity();
  }
});
searchInput.addEventListener("input", () => searchInput.setCustomValidity(""));

async function registerSearchTool() {
  if (!document.modelContext) return;
  await document.modelContext.registerTool({
    name: "search-pea-varieties",
    title: "Search Pea Varieties",
    description: "Search the website's pea-variety catalogue by text and display the results.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 100, description: "Variety search text." } },
      required: ["query"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: true },
    execute: async (input) => {
      try {
        const data = searchVarieties(input);
        return JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false,
        });
      } catch {
        return JSON.stringify({
          content: [{ type: "text", text: "Enter a search query between 1 and 100 characters." }], isError: true,
        });
      }
    },
  }, { signal: pageLifetime.signal });
}

disable.addEventListener("click", () => void disableFeedback());
window.addEventListener("pagehide", () => {
  pageLifetime.abort();
  void disableFeedback();
}, { once: true });
void registerSearchTool().catch(() => {
  searchResults.textContent = "Agent search is unavailable. Use the search form.";
});
void enableFeedback();
