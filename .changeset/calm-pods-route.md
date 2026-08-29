---
"@emseepea/server": patch
---

Reject missing or conflicting MCP HTTP headers before sign-in or application
work starts. Streamed responses now have tests proving proxy servers should not
hold progress updates and stale stream IDs do not replay old progress.
