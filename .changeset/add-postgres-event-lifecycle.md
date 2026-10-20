---
"@emseepea/server": patch
---

Add opt-in PostgreSQL 17 storage for external Model Context Protocol (MCP) Events subscription lifecycles. It uses explicit migrations and separate observation and mutation pools. It persists owner-scoped subscription generations, renewals, revocations, and callback credentials. This release does not deliver events, configure a native client, integrate feedback, perform group erasure, or complete issue #174.
