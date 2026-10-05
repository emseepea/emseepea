# ChatGPT feedback-reply Events smoke server

This is a temporary, synthetic-data example for checking a real ChatGPT
`feedback.reply.ready` webhook subscription and protected reply retrieval. It is
not an initializer, support system, or production identity provider. It uses
Node.js 24's built-in SQLite, one synthetic ChatGPT OAuth client, temporary
PIN-based OAuth, and a local admin endpoint to record a synthetic team reply.
Both the feedback conversation and its Events subscriptions use the same
framework-normalized OAuth `clientId`. A missing client ID is rejected.

Use Node.js 24 and install the repository dependencies before running this
example. Set these environment variables:

| Variable | Purpose |
| --- | --- |
| `DEMO_MCP_URL` | Public HTTPS `/mcp` URL of the first forwarder. |
| `DEMO_AUTH_URL` | Public HTTPS base URL of the second forwarder. |
| `DEMO_PIN` | Temporary, 12+ character sign-in PIN. |
| `DEMO_ADMIN_TOKEN` | Temporary, 24+ character token for the team-reply endpoint. |
| `DEMO_DB_FILE` | Absolute path to a disposable SQLite file outside the repository. |

1. Run `node --test dogfood/events/test.mjs` from the repository root.
2. Start two HTTPS forwarders to `127.0.0.1:3101` (MCP) and
   `127.0.0.1:3102` (OAuth). Set `DEMO_MCP_URL` to the public MCP URL ending in
   `/mcp` and `DEMO_AUTH_URL` to the public OAuth base URL.
3. Set the remaining variables in the table and run
   `node dogfood/events/server.mjs` from the repository root.
4. In ChatGPT developer mode, create a custom MCP server using `DEMO_MCP_URL`,
   OAuth, and dynamic client registration. Authorize with the temporary PIN.
5. In a **Work** chat, create one synthetic feedback thread. Keep the returned
   thread ID private. Ask ChatGPT to monitor that exact thread for
   `feedback.reply.ready` and to read it with `get-feedback-thread`. Once
   ChatGPT confirms monitoring, record one synthetic team reply locally:

   ```sh
   curl -X POST http://127.0.0.1:3101/demo/feedback/THREAD_ID/replies \
     -H 'content-type: application/json' \
     -H "x-demo-admin-token: $DEMO_ADMIN_TOKEN" \
     --data '{"message":"A synthetic support reply."}'
   ```

6. Check the resulting ChatGPT chat for an event-triggered response with the
   reply's meaning and the exact thread ID. Confirm the protected thread now has
   an `offeredToClientAt` timestamp for the team message. A successful local
   request, queued webhook, or offer timestamp is not proof that the person saw
   or understood the reply; record the ChatGPT response separately.
7. Pause the monitoring task and stop both forwarders and the server.

Keep both secrets, thread IDs, and callback details out of source control and
logs. Use only synthetic feedback text. The event carries owner, thread,
message, and source-event references, not the reply body. The PIN flow is
deliberately limited to this test; replace it with a real authorization server
for any durable deployment. Public forwarders are temporary, offer no uptime
guarantee, and should be stopped after the test.

This one-session harness deliberately accepts synchronous SQLite, per-message
JSON rows, unindexed scans, and one local process. It makes no throughput,
latency, concurrency, availability, durable-production, customer, adopter
`PROD_VERIFIED`, or human-receipt claim. Do not use it as an initializer or a
supported deployment pattern.
