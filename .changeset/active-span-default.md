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

Use valid active local OpenTelemetry context by default, so applications with HTTP instrumentation get a coherent request/backend trace without an extra option or duplicate framework SERVER span. Add `useActiveSpan: false` to opt out and use HTTP-header extraction. Keep `httpInstrumentation` as a deprecated alias; an explicit `useActiveSpan` takes precedence. Preserve clean context boundaries and existing fallback behavior. Update and verify the public SDK guide with the default adapter.
