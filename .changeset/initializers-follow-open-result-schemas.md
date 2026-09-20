---
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

Start new projects on the release that publishes result schemas open

Each starter pins a version of the server package. Projects you create from it
use that version. That pin now points at the release that publishes result
schemas open. A project you start from one of these starters begins with result
schemas that a client can tolerate a new field in.

Two starters, `@emseepea/create-html-ui-server` and
`@emseepea/create-react-ui-server`, also carry a copy of the shared example
result schema. That copy is open now too, so the schema you would copy from
publishes an open contract rather than a closed one.

You do not need to do anything. This only affects projects created after this
release.
