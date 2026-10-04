# ChatGPT MCP Events smoke server

This is a temporary, synthetic-data example for checking a real ChatGPT
`note.created` webhook subscription. It is not an initializer or a production
identity provider. It uses Node.js 24's built-in SQLite, a single account,
temporary PIN-based OAuth, and a local admin endpoint to create demo notes.

Use Node.js 24 and install the repository dependencies before running this
example. Set these environment variables:

| Variable | Purpose |
| --- | --- |
| `DEMO_MCP_URL` | Public HTTPS `/mcp` URL of the first forwarder. |
| `DEMO_AUTH_URL` | Public HTTPS base URL of the second forwarder. |
| `DEMO_PIN` | Temporary, 12+ character sign-in PIN. |
| `DEMO_ADMIN_TOKEN` | Temporary, 24+ character token for the note-creation endpoint. |
| `DEMO_DB_FILE` | Absolute path to a disposable SQLite file outside the repository. |

1. Run `node --test dogfood/events/test.mjs` from the repository root.
2. Start two HTTPS forwarders to `127.0.0.1:3101` (MCP) and
   `127.0.0.1:3102` (OAuth). Set `DEMO_MCP_URL` to the public MCP URL ending in
   `/mcp` and `DEMO_AUTH_URL` to the public OAuth base URL.
3. Set the remaining variables in the table and run
   `node dogfood/events/server.mjs` from the repository root.
4. In ChatGPT developer mode, create a custom MCP server using `DEMO_MCP_URL`,
   OAuth, and dynamic client registration. Authorize with the temporary PIN.
5. In a **Work** chat, ask ChatGPT to monitor the `demo` inbox for
   `note.created` and read arriving notes with `get_demo_note`. Once ChatGPT
   confirms monitoring, create one note locally:

   ```sh
   curl -X POST http://127.0.0.1:3101/demo/notes \
     -H 'content-type: application/json' \
     -H "x-demo-admin-token: $DEMO_ADMIN_TOKEN" \
     --data '{"text":"A synthetic test note."}'
   ```

6. Check the resulting ChatGPT chat for an event-triggered response with the
   same note ID and text. The server logs `get_demo_note <id>` if ChatGPT called
   the read tool. A successful local request or queued webhook is not proof of
   ChatGPT follow-up; record that separately.
7. Pause the monitoring task and stop both forwarders and the server.

Keep both secrets out of source control and logs. Use only synthetic note text.
The PIN flow is deliberately limited to this test; replace it with a real
authorization server for any durable deployment. Public forwarders are
temporary, offer no uptime guarantee, and should be stopped after the test.
