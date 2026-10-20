---
"@emseepea/server": minor
---

Add opt-in external lifecycle storage for MCP Events. Adopters can persist subscription identity and activation state outside the server process. The framework continues to reject unsafe work when authorization, callback verification, request deadlines, cancellation, or bounded shutdown checks fail. Existing in-memory Events configuration remains compatible.
