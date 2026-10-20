---
"@emseepea/server": minor
---

Add an optional, dormant PostgreSQL dispatch ledger for external Model Context Protocol (MCP) Events delivery. An explicit migration records stable provider task identity, a configuration fingerprint, time-limited leases and reconciliation outcomes. The provider-neutral reconciler can target one existing delivery. It can also inspect up to 100 due deliveries per invocation and honours an explicit pause signal. It creates no routes, timers, provider jobs, credentials or automatic scheduling. This increment does not activate Cloud Tasks, deletion, feedback backends, native execution or production use.
