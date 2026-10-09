---
"@emseepea/server": minor
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

Add authenticated private resource inventory listing to protected resource
templates. Callbacks receive the validated caller and bounded query position;
opaque cursors expire fifteen minutes after the first page and remain local to
the serving process. Reads recheck access. Document ownership, authorization,
live pagination, and restart behavior.

Refresh initializer dependency versions for the new server release.
