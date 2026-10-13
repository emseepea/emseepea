---
"@emseepea/testing": minor
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

Add optional native resource evidence to Codex semantic conversations. Set `nativeResources: true` to record recognized resource operations separately from application-tool calls and include their returned contents in meaning checks. The option is off by default; strict failure and isolation checks remain in force.

The retained genuine AI evidence covers a synthetic mixed tool/resource journey. It does not qualify general resource-only discovery, independent HTTP authentication, production learner behavior or recovered failed invocations. Generated starter projects use the updated testing dependency.
