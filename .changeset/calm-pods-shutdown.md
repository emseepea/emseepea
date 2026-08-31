---
"@emseepea/server": patch
---

Add an optional dependency-readiness check and a time-limited telemetry flush
during server shutdown. Keep dependency details out of readiness replies and
prevent flushing before final request measurements are recorded.
