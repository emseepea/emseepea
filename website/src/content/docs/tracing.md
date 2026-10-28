---
title: Traces, metrics and logs
description: Export MCP request traces, useful HTTP latency metrics and safe correlated logs with the standard OpenTelemetry Node SDK.
---

Use the standard OpenTelemetry Node SDK to collect request traces and HTTP
metrics and safe request-completion logs. Em See Pea supplies instrumentation;
your application owns the SDK,
exporters and shutdown. No provider setup is needed inside your tools.

## Start with console output

Install these dependencies in your application:

```sh
npm install @emseepea/server zod @opentelemetry/api@1.9.1 @opentelemetry/sdk-node@0.221.0
```

Save the SDK setup in `telemetry.mjs`. This compatible SDK version configures
context management, W3C trace propagation and all three signal providers.
Automatic resource detection is disabled so process,
host and environment attributes are not added to the exported resource.

```js title="telemetry.mjs"
import { NodeSDK } from "@opentelemetry/sdk-node";

process.env.OTEL_TRACES_EXPORTER ??= "console";
process.env.OTEL_METRICS_EXPORTER ??= "console";
process.env.OTEL_LOGS_EXPORTER ??= "console";
process.env.OTEL_EXPORTER_OTLP_TIMEOUT ??= "5000";
process.env.OTEL_BSP_EXPORT_TIMEOUT ??= "5000";
process.env.OTEL_BLRP_EXPORT_TIMEOUT ??= "5000";
process.env.OTEL_METRIC_EXPORT_TIMEOUT ??= "5000";
process.env.OTEL_METRIC_EXPORT_INTERVAL ??= "60000";

export const sdk = new NodeSDK({
  serviceName: "status-service",
  autoDetectResources: false,
});
sdk.start();
```

Save the server in `tracing-server.mjs`:

```js title="tracing-server.mjs"
import { trace } from "@opentelemetry/api";
import { createEmseepea, defineTool, openTelemetry, serveEmseepea } from "@emseepea/server";
import { z } from "zod";
import { sdk } from "./telemetry.mjs";

const backendTracer = trace.getTracer("my-application.backend");
const running = await serveEmseepea(createEmseepea({
  name: "tracing-example",
  version: "1.0.0",
  observability: [openTelemetry({ logs: true })],
  tools: [defineTool({
    name: "read-status",
    description: "Read the example backend status.",
    access: "public",
    inputSchema: z.object({}),
    outputSchema: z.object({ status: z.string() }),
    async handler() {
      return backendTracer.startActiveSpan("backend.read", async (span) => {
        try {
          // Replace this with your backend operation or its instrumentation.
          await Promise.resolve();
          return { data: { status: "ready" } };
        } finally { span.end(); }
      });
    },
  })],
}), { port: Number(process.env.PORT ?? 3000) });
console.log(`MCP endpoint: ${running.url}`);

let stopping;
function stop() {
  return stopping ??= (async () => {
    try { await running.close(); }
    finally { await sdk.shutdown(); }
  })().catch(() => {
    console.error("Server or telemetry shutdown failed.");
    process.exitCode = 1;
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
```

Load the SDK before the application:

```sh
node --import ./telemetry.mjs tracing-server.mjs
```

Call `read-status` with your MCP client, then stop the server with Ctrl+C to
export pending telemetry. `backend.read` and `mcp.request` share a trace, with
the backend span under the request. The SDK also exports
`emseepea.http.requests` in requests and `emseepea.http.response.duration` in
seconds. Without installed providers, the framework's telemetry APIs are no-ops.

## Send all three signals to an OTLP collector

Use the same files with your collector's OTLP/HTTP endpoint:

```sh
OTEL_TRACES_EXPORTER=otlp OTEL_METRICS_EXPORTER=otlp OTEL_LOGS_EXPORTER=otlp \
OTEL_EXPORTER_OTLP_PROTOCOL=http/json \
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.example.com \
node --import ./telemetry.mjs tracing-server.mjs
```

Replace the example endpoint with your collector. The SDK appends `/v1/traces`
and `/v1/metrics`, plus `/v1/logs`. Configure collector authentication through your deployment's
secret handling.

Review inherited `OTEL_*` settings: they can change exporters,
endpoints, headers, sampling and propagation. This recipe does not enable
automatic HTTP or backend instrumentation; add those only after reviewing their
data-capture policies.

## Use existing HTTP instrumentation

`openTelemetry()` uses a valid active local span as its parent by default.
With incoming HTTP instrumentation, Em See Pea creates an INTERNAL
`mcp.request` child of the transport SERVER span, followed by your backend
spans. No extra framework option is needed. The framework never modifies or
ends the application's transport span.

Em See Pea copies only validated local trace identity into a clean context;
it excludes ambient baggage, trace state and other context entries. An absent,
invalid or remote active context falls back to HTTP-header extraction and a
framework SERVER span. Active context takes precedence over incoming headers.

To always extract the parent from HTTP headers and create a framework SERVER
span, set `openTelemetry({ useActiveSpan: false })`.

`useActiveSpan` defaults to `true`. The previous `httpInstrumentation` option
is a deprecated alias; an explicitly supplied `useActiveSpan` takes precedence.
Existing `httpInstrumentation: false` configurations retain their opt-out.
The adapter uses the active span without proving which instrumentation created it.

To try this with the example above, install the compatible HTTP instrumentation:

```sh
npm install @opentelemetry/instrumentation-http@0.221.0
```

Replace `telemetry.mjs` with the following. Keep the server, startup command
and shutdown handler unchanged.

```js title="telemetry.mjs"
import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

process.env.OTEL_TRACES_EXPORTER ??= "console";
process.env.OTEL_METRICS_EXPORTER ??= "console";
process.env.OTEL_LOGS_EXPORTER ??= "console";
process.env.OTEL_EXPORTER_OTLP_TIMEOUT ??= "5000";
process.env.OTEL_BSP_EXPORT_TIMEOUT ??= "5000";
process.env.OTEL_BLRP_EXPORT_TIMEOUT ??= "5000";
process.env.OTEL_METRIC_EXPORT_TIMEOUT ??= "5000";
process.env.OTEL_METRIC_EXPORT_INTERVAL ??= "60000";

export const sdk = new NodeSDK({
  serviceName: "status-service",
  autoDetectResources: false,
  instrumentations: [new HttpInstrumentation({
    disableOutgoingRequestInstrumentation: true,
  })],
});
sdk.start();
```

The instrumentation must start before the application imports the HTTP server.
This example instruments incoming HTTP only. HTTP instrumentation has its own
capture policy; framework redaction does not cover its transport attributes.
Review that policy before enabling it in your application.

This mode changes
trace parenting, not the meaning of framework HTTP metrics or request timing;
it does not introduce a separate MCP operation timer.

## Interpret HTTP latency

The counter and histogram describe the HTTP request through response completion
or disconnection. They identify bounded MCP method, configured capability,
status and outcome. Streaming duration includes the open response lifetime;
it is not a separate MCP operation timer.

The duration histogram recommends second-based boundaries:
`0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10`.
This separates millisecond requests that the SDK's default buckets grouped
together.

It changes the default bucket layout in providers that honor instrument
advice; names, units, timing and attributes stay the same. Advice is an
experimental OpenTelemetry API option. Your application's metric Views can
override it; check the buckets exported by your provider. These custom metric
names do not claim full OpenTelemetry semantic-convention compliance.

## Find failed tool calls

Use your tracing backend's standard ERROR span-status filter to find genuine
tool failures, including failures returned with HTTP 200. No custom outcome
query or additional framework option is required.

The framework applies this mapping to its own request span:

| Request outcome | Span status | `error.type` |
| --- | --- | --- |
| Finished HTTP 5xx response | ERROR | HTTP status-code string, such as `503` |
| Uncancelled tool failure outside HTTP 4xx | ERROR | `tool_error` |
| Success, routine HTTP 4xx or remaining protocol outcomes | UNSET | Omitted |
| Expected cancellation or disconnection | UNSET | Omitted |

A framework deadline expiry is a genuine tool failure. Expected cancellation
comes from the SDK request or invocation/shutdown signal. A handler-thrown
`AbortError` without such cancellation remains a tool failure. Disconnection
takes precedence; a finished HTTP 5xx response remains an error even if work
was also cancelled.

Error status and type belong only to the framework span. The application still
owns the transport span. Exception messages, stacks, arguments and results are
excluded; the framework adds no status description or exception event.
Existing completion outcomes, logs, metrics and HTTP lifetime timing stay the
same. This does not claim full MCP operation semantic-convention compliance.

## Correlate safe completion logs

`openTelemetry({ logs: true })` emits one INFO record when each MCP HTTP
response finishes or disconnects. Its event name is `mcp.request` and its fixed
body is `MCP HTTP request ended`. Bounded attributes identify method, configured
capability, status and outcome. In these completion logs, errors use the outcome
attributes; exception objects and request payloads are not recorded.

The record uses the local request span's trace and span IDs and the response's
completion timestamp, even if delivery occurs later. Trace IDs are not metric
labels. Logs are off by default with `openTelemetry()` or `{ logs: false }`.
A missing LoggerProvider is a no-op; the example's SDK supplies one.

Without a valid local request span, the completion record is uncorrelated.
A valid unsampled local span can still supply correlation IDs even when the
tracing sampler does not export it. No unrelated ambient span, baggage or
opaque `tracestate` is copied into completion-log processing.

These are server operational logs sent to your exporter. They are separate from
client-visible MCP `reportLog` messages. Other application or backend logging
has its own data-capture policy.

## Shut down in order

Close the HTTP server first, then await `sdk.shutdown()` once. The SDK exports
pending traces, metrics and logs and releases its providers. This recipe sets
five-second exporter and metric-reader timeouts; configure them for your
collector.

They are per export, not an overall application shutdown deadline.
The framework's adapter-flush timeout does not bound application-owned SDK
shutdown. Arrange your process supervisor's grace period accordingly.
If shutdown fails, the example reports a fixed message and exits with code 1;
a collector outage does not change a tool response that has already completed.

## Keep trace data within its trust boundary

Em See Pea passes only bounded `traceparent` and `tracestate` headers to the
configured propagator. It retains validated span context and excludes baggage.
Missing or invalid parent context starts a new trace. Incoming trace IDs are
caller-controlled correlation data, never identity or authorization.

Framework spans, metrics and completion logs exclude request arguments, results
and credentials.
The resource in this recipe contains the known service name and SDK identity.
Your backend instrumentation and exporters have their own data-capture policies.

A [bounded native ChatGPT test](https://github.com/emseepea/emseepea/issues/198#issuecomment-6438956084)
completed immediate and awaited calls. Tracing headers reached the fixture through
its forwarder; their originating injector was not established.

Neither call
included tracing fields in `params._meta`. That observation does not establish
universal client support or incompatibility, and no `_meta` propagation is added
for that tested path.
