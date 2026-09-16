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

Add reusable WCAG contrast-ratio and assertion helpers so applications can test
their own opaque sRGB color pairs without reimplementing the WCAG luminance and
contrast calculations. This release also aligns the embedded
`@emseepea/testing` dependency in all 11 initializers.
