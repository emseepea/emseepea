---
"@emseepea/server": minor
"@emseepea/create-api-backed-server": patch
"@emseepea/create-database-schema-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-multi-instance-postgres-server": patch
"@emseepea/create-openapi-backed-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-soap-backed-server": patch
"@emseepea/create-tool-server": patch
---

Add `createEmseepeaFetch` for stateless MCP tools on Cloudflare Workers. Use the same explicitly registered tool on Workers and Node/Fastify. The Fetch entry point serves `/mcp` and checks the request’s host and optional port, supplied browser origin, body size, and authorization before tool execution.
