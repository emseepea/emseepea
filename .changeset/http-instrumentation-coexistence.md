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
"@emseepea/website": patch
---

Add `openTelemetry({ httpInstrumentation: true })` for applications with existing HTTP instrumentation. The framework creates an INTERNAL child of a valid active local transport span, avoiding another SERVER span; defaults and HTTP-header fallback stay unchanged. Document and verify the standard SDK example with real transport instrumentation, correlated logs and application-owned shutdown.
