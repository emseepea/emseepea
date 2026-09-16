import { defineMcpAppResource, type McpAppResourceDefinition } from "../../packages/framework/src/index.js";

const base = {
  name: "type-check-app", uri: "ui://type-check/app", title: "Type-check app",
  language: "en", bodyMarkup: '<main id="app"></main>',
};

defineMcpAppResource({ ...base, access: "public", script: "" });
defineMcpAppResource({ ...base, access: "protected", requiredScopes: ["app:read"], bundleUrl: new URL("file:///app.js") });

// @ts-expect-error Protected resources need scopes.
const missingScopes = { ...base, access: "protected", script: "" } satisfies McpAppResourceDefinition;
// @ts-expect-error Public resources cannot claim protected scopes.
const publicScopes = { ...base, access: "public", requiredScopes: ["app:read"], script: "" } satisfies McpAppResourceDefinition;
// @ts-expect-error Inline script and local bundle are exclusive.
const mixedSources = { ...base, access: "public", script: "", bundleUrl: new URL("file:///app.js") } satisfies McpAppResourceDefinition;
// @ts-expect-error One script source is required.
const missingSource = { ...base, access: "public" } satisfies McpAppResourceDefinition;
void missingScopes;
void publicScopes;
void mixedSources;
void missingSource;
