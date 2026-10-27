# ChatGPT OpenTelemetry compatibility probe

This synthetic discovery fixture checks two separate questions: whether a real
ChatGPT call carries HTTP or MCP `_meta` trace context, and whether its server
operation boundaries support useful metrics. It does not add production
instrumentation or establish ChatGPT support by running locally.

## Qualify the local collector

From this repository with its pinned Node.js and installed dependencies, run:

```sh
node --test dogfood/otel-chatgpt/test.mjs
```

The controls make actual authenticated HTTP calls. They check immediate and
ordinary awaited tool responses, exporter counts/seconds, separate HTTP and
`_meta` carriers, invalid/missing carriers, redaction and cleanup. They are
labelled `controlled-local`; all native support verdicts remain `UNKNOWN`.

## Prepare the owned native test

Use a dedicated ChatGPT test account and synthetic run. Reuse the repository's
[native ChatGPT journey contract](../../packages/testing/README.md#opt-in-to-native-chatgpt-browser-journeys)
for browser assertions and authenticated server observations. No browser login,
profile transfer, connection consent or HTTPS forwarding is automated here.

Provide owned temporary HTTPS forwarders to the MCP loopback port 3101 and
OAuth loopback port 3102, as in the existing
[smoke fixture](../events/README.md). The OAuth base URL must have the root path;
the public MCP URL must end at `/mcp`. This fixture reuses only the synthetic
OAuth component, not the Events store or admin endpoints.

Set these variables in your private local environment:

| Variable | Purpose |
| --- | --- |
| `OTEL_PROBE_MCP_URL` | Owned public HTTPS URL ending in `/mcp`. |
| `OTEL_PROBE_AUTH_URL` | Owned public HTTPS OAuth base URL. |
| `OTEL_PROBE_PIN` | Temporary sign-in PIN of at least 12 characters. |
| `OTEL_PROBE_EVIDENCE_FILE` | New absolute private file path outside the repository. |
| `OTEL_PROBE_RUN_ID` | Optional synthetic UUID; otherwise a new UUID is printed. |

```sh
node dogfood/otel-chatgpt/server.mjs
```

Connect only this dedicated test endpoint in ChatGPT and complete its normal
OAuth consent using your private PIN. Use the printed run ID to ask ChatGPT to
call `observe-telemetry` once with `mode: "immediate"` and once with
`mode: "awaited"`. The latter awaits a short ordinary tool operation; it is not
a task/job or progress-support test. Do not ask the model to invent tracing
metadata or treat an answer describing a tool call as proof that it happened.

Retain the owned native journey's evidence and its authenticated server
observations. A token or user agent alone cannot establish ChatGPT provenance.
The probe sidecar stays `native-pending`/`UNKNOWN` until it is joined to that
verified journey using run ID and sequence. The generic journey runner drops
extra telemetry fields, so its PASS alone does not verify this sidecar.

After the pair, stop the probe with Ctrl-C. It closes both local servers,
flushes the in-memory meter and writes the sidecar with private permissions.
It refuses to overwrite a previous evidence file. Remove the temporary ChatGPT
connection, forwarders and fixtures; perform conversation cleanup under the
native journey contract. Record cleanup that could not be completed honestly.

## Interpret the evidence

The sidecar records request receipt, parsed operation receipt, handler entry
and return, the corresponding result frame's emission, and HTTP finish. Its
probe-scoped duration runs from parsed receipt to the timestamp immediately
before a successful corresponding transport `write`/`end` call. This is server
emission, not client receipt, handler duration or the later HTTP close. It
does not publish the Development `mcp.server.operation.duration` instrument.

Only bounded carrier presence/parser acceptance and permitted comparisons are
retained. Raw headers, opaque carrier values, baggage, arbitrary metadata,
arbitrary arguments, credentials and error text are excluded. Trace/run identifiers are
never metric dimensions. The only metric attribute is the fixture's mode.
Known protocol versions observed in the HTTP header and MCP metadata are
recorded separately; other values become fixed categories. The server's
supported baseline is not proof of the client's negotiated protocol.

For genuine completed calls, report each carrier path as observed or not
observed on that tested client/path/date. Valid wire context is not proof that
ChatGPT exported a parent span. Missing calls or unavailable access remain
`UNKNOWN`; local controls cannot change that verdict. A successful pair can
establish metric shape, counts, units and boundaries, not percentile performance,
error coverage, universal compatibility or full semantic-convention compliance.

Use that matrix to omit unsupported additions for the tested ChatGPT path.
Operation metrics are server-side: absent client trace context does not by
itself make server measurements unsupported or useless.

The current fixture measures its observed ordinary JSON responses. If a native
path uses another wire form, the corresponding boundary stays unmeasured and
the metric decision is incomplete; no guessed SSE or task support is inferred.
