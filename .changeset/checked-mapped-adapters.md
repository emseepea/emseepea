---
"@emseepea/server": patch
---

Add mapped tools that check backend commands and results. The adapter runs
inside the shared time limit and cancellation path. Tools can add a quick
availability check without disappearing from discovery.

Add `@emseepea/server/http`, a fixed-origin HTTPS client for read-only public
JSON APIs. It blocks private network addresses, redirects, compressed or
oversized responses, and non-JSON data. Adapter results are now `unknown` until
the declared backend output schema checks them.
