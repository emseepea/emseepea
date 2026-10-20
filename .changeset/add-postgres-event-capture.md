---
"@emseepea/server": patch
---

Add opt-in PostgreSQL 17 storage for capturing external Model Context Protocol (MCP) Events. The `@emseepea/server/events-postgres` subpath atomically records a stable source identity and the eligible subscription-generation intents in a caller-owned transaction using `REPEATABLE READ` or `SERIALIZABLE` isolation. This release does not configure native client subscriptions or deliver events.
