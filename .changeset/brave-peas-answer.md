---
"@emseepea/testing": minor
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-tool-server": patch
---

Allow deliberately unsuccessful semantic journeys to accept either no tool
call or one named feedback call, while still rejecting unrelated or duplicate
calls. Keep successful starter journeys strict about negative feedback.
