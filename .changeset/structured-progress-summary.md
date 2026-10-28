---
"@emseepea/create-progress-streaming-server": patch
---

Add a declared `summary` field to the progress example's structured result and reuse that same data-derived value as text content. Preserve all existing result fields, values, progress, cancellation and access behavior. Clients that present structured output now receive the same readable completion summary as text clients.
