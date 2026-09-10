---
"@emseepea/server": minor
"@emseepea/testing": minor
"@emseepea/feedback": minor
"@emseepea/create-api-backed-server": patch
"@emseepea/create-database-schema-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-multi-instance-postgres-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-soap-backed-server": patch
"@emseepea/create-tool-server": patch
---

Add optional detailed feedback submissions, protected append-only support
conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
adapters, authenticated provider event ingestion, and typed application hooks.

Allow every server factory to compose optional tools through `additionalTools`.
Add a semantic assertion that successful application journeys did not record
negative feedback, and run it against the real feedback tool in every starter.
