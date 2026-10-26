---
title: Trace requests
description: Follow an MCP request through Em See Pea into instrumented backend calls with OpenTelemetry.
---

Use `@emseepea/server` 0.25.1 or later to follow an incoming trace through an
MCP request and into your backend work. This example uses a console exporter
so you can check the span relationships before choosing a telemetry service.

## Configure tracing before starting the server

`openTelemetry()` creates a server span when an MCP HTTP request starts and
ends it when the response finishes or the caller disconnects. It keeps that
span active through asynchronous request work, so instrumented backend calls
can create child spans. Request counters and duration histograms keep their
existing names and safe attributes.

First configure your OpenTelemetry provider, asynchronous context manager,
trace-context propagator and exporter. Em See Pea does not install global
providers or instrument your backends. Without a tracing provider, its trace
API is a no-op. Without context management or propagation, traces will not
connect across asynchronous work or incoming requests respectively.

This Node.js example exports traces to the console. Save it as
`tracing-server.mjs` in a project with these dependencies:

```sh
npm install @emseepea/server zod @opentelemetry/api@1.9.1 @opentelemetry/core@2.10.0 @opentelemetry/context-async-hooks@2.10.0 @opentelemetry/sdk-trace@2.10.0
```

```js title="tracing-server.mjs"
import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { BatchSpanProcessor, ConsoleSpanExporter, TracerProvider } from "@opentelemetry/sdk-trace";
import { createEmseepea, defineTool, openTelemetry, serveEmseepea } from "@emseepea/server";
import { z } from "zod";

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
const provider = new TracerProvider({
  spanProcessors: [new BatchSpanProcessor({ exporter: new ConsoleSpanExporter() })],
});
trace.setGlobalTracerProvider(provider);
const backendTracer = trace.getTracer("my-application.backend");
const telemetry = { ...openTelemetry(), flush: () => provider.forceFlush() };

const running = await serveEmseepea(createEmseepea({
  name: "tracing-example",
  version: "1.0.0",
  observability: [telemetry],
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
}), { port: 3000 });
console.log(`MCP endpoint: ${running.url}`);

async function stop() {
  await running.close();
  await provider.shutdown();
  context.disable();
  propagation.disable();
  trace.disable();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
```

## Check the result

Run `node tracing-server.mjs`, then call `read-status` with your MCP client.
The backend span and `mcp.request` span share a trace, with the backend span
under the request.

## Flush on shutdown

The adapter's flush callback gives pending spans a bounded
flush opportunity during server shutdown; the application then shuts down its
provider. Configure a meter provider and metric exporter separately to collect
the built-in request metrics.

## Keep trace data within its trust boundary

Em See Pea passes only bounded `traceparent` and `tracestate` headers to the
configured propagator. It retains validated span context and excludes baggage.
Missing or invalid parent context starts a new trace. Incoming trace IDs are
caller-controlled correlation data, never identity or authorization.

Framework spans and events exclude request arguments, results and credentials.
Your backend instrumentation has its own data-capture policy; review what it
records before enabling it.

