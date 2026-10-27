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

Add opt-in OpenTelemetry completion logs with `openTelemetry({ logs: true })`. Each fixed INFO record carries safe request attributes and the request completion time. Correlation IDs are included when a valid local request span is available. Logs remain off by default; application-owned SDK providers and exporters control delivery and shutdown.

Extend the standard Node SDK guide to export traces, HTTP metrics and correlated logs with one setup. Keep request payloads, credentials, baggage and opaque trace state out of completion records, and isolate synchronous signal failures from protocol work.
