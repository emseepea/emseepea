---
"@emseepea/feedback": minor
---

Add scoped PostgreSQL feedback update consumers with durable per-instance acknowledgements. Retained late commits remain eligible without timestamp cursors; callbacks and acknowledgement failures can be retried independently of email dispatch. Document at-least-once delivery, startup/reconnect replay, scope policy checks, retention, and cleanup.
