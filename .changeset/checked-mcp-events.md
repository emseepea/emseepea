---
"@emseepea/server": minor
---

Add opt-in authenticated MCP Events webhook subscriptions with adopter-owned durable storage. Before saving a subscription, the server checks that its HTTPS callback resolves only to public addresses and verifies a signed challenge. It signs deliveries, rechecks access, and retries transient failures within a fixed limit. Basic servers remain unchanged.
