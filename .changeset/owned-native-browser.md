---
"@emseepea/testing": patch
"@emseepea/create-api-backed-server": patch
"@emseepea/create-database-schema-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-multi-instance-postgres-server": patch
"@emseepea/create-openapi-backed-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-soap-backed-server": patch
"@emseepea/create-tool-server": patch
---

Allow the opt-in native ChatGPT runner to attach to an adopter-owned,
already-authorized Chromium session through a loopback CDP browser WebSocket.
Require matching browser-owner confirmation, use a separate test tab, and
disconnect without closing the owner browser.

Keep Chromium's sandbox enabled
in the existing setup and profile runner. Login, MFA, CAPTCHA, consent, server
evidence, and cleanup remain adopter-owned; live ChatGPT verification is pending.
Initializer patches update generated projects to use the testing package.
