---
"@emseepea/server": patch
---

Add bounded request-scoped progress reporting to static resources, resource
templates, and prompts. Handlers receive `reportProgress` only when the current
request supplies a progress token, with existing event-count and event-size
limits.
