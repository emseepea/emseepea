---
"@emseepea/server": patch
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

Make OpenTelemetry request spans cover the actual HTTP request lifetime and
keep their context active through asynchronous tool execution. Continue valid
incoming trace context so instrumented backend calls can appear beneath the
request span. Preserve redacted metrics and isolate telemetry failures from
protocol execution. The package guide now includes provider, context,
propagation and shutdown setup.

Update generated starter projects to use the framework release containing
request tracing.
