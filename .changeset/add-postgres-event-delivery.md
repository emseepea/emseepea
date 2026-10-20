---
"@emseepea/server": minor
---

Add an opt-in dormant PostgreSQL-backed worker for delivering captured Model Context Protocol (MCP) Events to checked webhook subscriptions. The worker requires an explicit migration and invocation. It does not create routes, timers, provider jobs, or activate delivery automatically. It rechecks current subscription authority before each attempt, preserves durable retry and terminal receipts, and limits each delivery to four reserved attempts. This increment does not provide source or subscription erasure. It also does not activate a complete durable delivery composition.
