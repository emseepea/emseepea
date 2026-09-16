---
"@emseepea/server": patch
"@emseepea/create-tool-server": patch
"@emseepea/create-api-backed-server": patch
"@emseepea/create-openapi-backed-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-multi-instance-postgres-server": patch
"@emseepea/create-database-schema-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-soap-backed-server": patch
---

Add `defineMcpAppResource` to package a Model Context Protocol (MCP) App HTML
resource with matching MCP Apps `ui` metadata and ChatGPT Apps compatibility
aliases. The helper validates the URI, script, language, and content security
policy (CSP) when the resource is defined. Update the React UI starter to use
the helper; keep the other starters' embedded server dependency aligned with
this release.
