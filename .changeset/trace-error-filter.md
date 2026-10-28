---
"@emseepea/server": patch
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

Make genuine tool failures visible through standard OpenTelemetry ERROR span filtering, including tool errors returned with HTTP 200. Add bounded span error types while preserving routine client refusals, expected cancellation, genuine deadline failures and application-owned parent spans. Keep exception details and request payloads excluded, and leave completion events, logs, metrics and timing unchanged. Document the mapping and verify the real SDK failure/success paths.
