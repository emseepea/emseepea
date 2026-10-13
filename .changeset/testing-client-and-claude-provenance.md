---
"@emseepea/testing": patch
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

Record MCP-client and Claude CLI versions as provenance without rejecting them by version number. The expected client package identity and valid version metadata remain required. Qualification still depends on native invocation, event, isolation and failure-handling checks.

Generated starter projects use the corrected testing dependency. This patch does not add native resource-helper support or change failed-call adjudication.
