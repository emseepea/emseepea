---
"@emseepea/feedback": minor
---

Replace GitHub-specific prefixes in public feedback identifiers with provider-neutral thread, message and event references. Numeric provider identifiers remain visible. This changes existing identifiers: obtain current conversation references and recreate reply-event subscriptions after upgrading.

Persistent data: compatible; provider records and authorization are unchanged.
