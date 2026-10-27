---
"@emseepea/server": patch
"@emseepea/website": patch
---

Recommend second-based HTTP duration histogram buckets so millisecond requests are distinguishable with the standard OpenTelemetry SDK. Application Views can override this instrument advice; metric names, units, timing and attributes stay the same.

Replace manual tracing setup in the guide with an application-owned Node SDK recipe that exports traces and request metrics, disables automatic resource detection, and shuts down both providers. Verify the copied recipe with real OTLP exports and fresh installed packages.
