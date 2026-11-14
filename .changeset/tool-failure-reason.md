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

Identify input rejection, execution failure, and output rejection in tool,
resource, and prompt telemetry. Adapters can read the optional `failureReason`
field. OpenTelemetry logs and spans use `emseepea.failure_reason`.

Request telemetry now names the Events catalogue, subscription, and
unsubscription methods. An optional adapter callback and OpenTelemetry logs
report terminal delivery failures and queue errors from the internal webhook
worker.
