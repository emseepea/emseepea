---
"@emseepea/feedback": minor
---

Add opt-in Firestore feedback pagination for MCP clients with a response size
limit. The paged tools return complete messages with a cursor for continuing
the same thread. The tool records an offer only for team replies it includes
in the returned page.
Existing feedback tools keep their current contract.
