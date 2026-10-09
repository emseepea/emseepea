---
"@emseepea/feedback": minor
"@emseepea/website": patch
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

Allow submission and conversation helpers to declare the actual effects of
adopter backends and hooks through checked, optional tool annotations.
Conversation overrides are keyed by public MCP tool name; omitted flags retain
the current defaults. Update generated projects to the new feedback version
and document configuration and classification responsibilities.
