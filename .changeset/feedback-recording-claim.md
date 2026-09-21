---
"@emseepea/feedback": patch
---

Only tell a user feedback was recorded after `submit-feedback` succeeds

When another tool's result reveals notable friction, the feedback tool now tells the AI to record it before answering. It also tells the AI not to claim a record exists until the tool succeeds. In one test, the AI had said it recorded feedback without calling the tool.
