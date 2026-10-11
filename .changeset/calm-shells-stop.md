---
"@emseepea/testing": patch
---

Explicitly disable the Codex CLI's stable `shell_tool` and `unified_exec` features during semantic checks. If the installed CLI rejects either setting, qualification fails without retrying with local execution enabled.
