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

Add an opt-in Events store conformance helper for disposable synthetic fixtures.
Check shared storage, complete subscription writes, queue leases, stale workers,
retries, and graceful reopen. Report missing queue evidence as inconclusive.
These checks do not establish crash recovery or native client execution.

Update generated starter projects to use the testing package when released.
