---
"@emseepea/server": minor
---

Add an internal Cloud Tasks adapter for the PostgreSQL Events dispatch ledger. It remains dormant. Tasks contain only the delivery identifier. The adapter uses fixed, trusted queue, endpoint and OpenID Connect settings. It limits credential access, requests, responses and concurrent work. It also supports cancellation and shutdown.

This increment adds no public export or routes. It does not connect the adapter to a worker or add worker identity verification. Automatic scheduling, feedback, erasure and production activation remain outside this increment.
