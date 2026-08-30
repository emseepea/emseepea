---
"@emseepea/server": patch
---

Allow public tools to send progress updates through a trusted reverse proxy.
Updates and the final result use the same HTTP response. Each new request can
go to a different server, without sticky sessions.

Existing request checks, size limits, deadlines, and cancellation still apply.
Tools that require sign-in cannot stream in the production proxy profile yet.
This does not add reconnect, replay, or subscriptions.
