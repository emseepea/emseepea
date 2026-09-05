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

Replace configuration-object semantic tests with readable, multi-turn
conversation tests. Assert exact tool calls, literal response content, and
model-judged response meaning with focused helpers built on Node assertions and
the existing isolated Em See Pea judge.
