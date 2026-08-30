---
"@emseepea/server": patch
---

Let application authors copy checked string, integer, and boolean tool
arguments into HTTP headers for routing. Invalid declarations, missing or
different values, and malformed encoded values are rejected before the tool
runs. The existing automated load test now exercises this route.
