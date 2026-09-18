---
"@emseepea/testing": minor
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

Add an opt-in `check` policy module to `emseepea-contract` for application-owned legacy baseline migration, normalization, and comparison. The CLI keeps discovery, extraction, redaction, diagnostics, and exit codes, while existing checks without a policy keep their current behavior.

Release every affected public initializer package together with the generated `@emseepea/testing` package it uses for development. This ensures that all affected packages are included in the release and can be verified.
