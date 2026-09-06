---
"@emseepea/server": patch
"@emseepea/create-tool-server": patch
"@emseepea/create-api-backed-server": patch
"@emseepea/create-sign-in-tool-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-multi-instance-sqlite-server": patch
---

Make validated structured tool data the default result. Tool handlers can omit
custom text, and Em See Pea will return the same data as `structuredContent`
and serialized JSON text for compatibility. The maintained tool examples now
demonstrate this smaller pattern.
