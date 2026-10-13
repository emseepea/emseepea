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

Add an experimental, opt-in Playwright adapter for adopter-owned ChatGPT browser journeys, with dedicated local human-login setup, explicit scenario execution, scoped server observations, application assertions, and required cleanup. Playwright remains optional and ordinary framework tests do not enable browser journeys. Deterministic contract tests and intercepted Chromium fixtures verify the adapter; live ChatGPT host qualification remains pending.
