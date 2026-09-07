---
"@emseepea/testing": minor
---

Make semantic test failures directly diagnosable from their saved evidence.
Reports now retain synthetic test conversations, advertised MCP tool exchanges,
expectations, and every judge reason while continuing to exclude provider and
harness credentials, provider events, transport configuration, environment
values, and stderr. Secrets inside test content are not detected or redacted.
