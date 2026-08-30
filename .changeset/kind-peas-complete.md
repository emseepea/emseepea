---
"@emseepea/server": patch
---

Guarantee that successful operations identify themselves as complete. Results
that can be cached now have tests proving that the existing defaults tell
clients not to reuse them or share them between callers.
