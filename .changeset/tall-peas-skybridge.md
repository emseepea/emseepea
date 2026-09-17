---
"@emseepea/server": minor
---

Allow `defineMcpAppResource` callers to preserve an established
`text/html+skybridge` contract. The existing `text/html;profile=mcp-app`
default remains unchanged, and the selected value is used for both resource
listing and returned content.
