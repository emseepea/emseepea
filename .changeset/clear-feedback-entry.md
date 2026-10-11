---
"@emseepea/feedback": minor
---

Remove the duplicate `create-feedback-thread` MCP tool. Use
`defineFeedbackSubmission` and its `submit-feedback` tool for every new feedback
conversation. `defineFeedbackConversation` now adds only reply, list, and get
operations.

Existing stored thread IDs remain valid for reply, list, and get operations.
For new submissions, the returned submission ID is the canonical thread ID for
those operations when both helpers use the same authorized scope projection.
Legacy callers should set the required `observation` field to one of the allowed
category values and set `detail` to `Subject: <subject>\n\n<message>`. The
complete constructed `detail` value, including the prefix and line breaks, must
not exceed 4,000 characters. The framework rejects an over-limit `detail` value
and does not truncate the subject or message content.

Move creation-event hooks to `defineFeedbackSubmission`, or share the same hook
set with both helpers, so `feedback.thread.created` continues to be dispatched.
