---
"@emseepea/feedback": minor
"@emseepea/server": minor
"@emseepea/website": patch
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

Add collection-aware feedback submission, protected operator retrieval, and
owner-scoped `feedback.submitted` events. Customer-facing servers submit
customer feedback only. Internal servers submit internal feedback and monitor
or read their authorized collections while the support backend remains
authoritative.

Add independently authorized subscription refresh, owner-specific event
catalogues, and targeted publication. Document account isolation, exact record
retrieval, durable storage, and customer and internal configuration.

Refresh generated starters to use the updated server and feedback packages.
