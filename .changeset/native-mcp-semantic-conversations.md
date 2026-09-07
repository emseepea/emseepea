---
"@emseepea/testing": minor
"@emseepea/create-tool-server": patch
"@emseepea/create-api-backed-server": patch
"@emseepea/create-sign-in-tool-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-multi-instance-sqlite-server": patch
---

Run semantic conversations through the provider's native MCP client. User
messages now reach the model unchanged, tool assertions come from native tool
events, and the removed `prepare()` API can no longer inject harness-created
context. The testing API and guide explain the evidence boundary.
