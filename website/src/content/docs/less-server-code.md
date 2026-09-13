---
title: Maintain less server code
description: Decide what Em See Pea can take over from an existing MCP server and plan a gradual migration.
---

If you already maintain an MCP server, you do not need to replace it to use
[the testing package](../ai-tests/). Changing the server framework is a separate
decision.

Consider it when you want to maintain less of the code around your tools.
Em See Pea uses Fastify. Moving from Express or another server framework is a
migration, not a drop-in replacement.

## Inventory each server surface before switching

A server surface is any contract that another client, developer, or operations
system relies on. Record each one separately instead of treating the server as
one replaceable component.

### Published MCP schemas: preserve

Keep each public capability name, description, input schema, output schema,
metadata field, and access rule that existing clients rely on. Translate the
application's declarations into Em See Pea's supported schema form, then
compare the actual discovery response with the published baseline.

Em See Pea validates the schemas you register, but it does not promise that a
schema produced by another framework will be byte-identical. Keep the old
server until the baseline comparison and required client journeys show that
any difference preserves the behavior its consumers rely on.

### Business and backend code: preserve

Keep business rules, provider clients, data mappings, and mappings between
public MCP schemas and private provider data in application-owned adapters. An
Em See Pea tool handler should call that code after the framework has checked
the public input. Do not move provider credentials, private response fields, or
transport details into the public MCP schema.

### Operational HTTP routes: adapt

`createEmseepea` returns the Fastify application. Register application-owned
routes directly with `app.get()`, `app.post()`, or `app.route()`.

You can also use
[`registerRoutes`](https://github.com/emseepea/emseepea/tree/main/packages/framework#register-http-route-modules-at-startup)
for file-owned routes. This lets an existing route method, path, response
status, content type, body, and access rule remain on the same HTTP server.

Em See Pea owns `POST /mcp`, `GET /healthz`, and `GET /readyz`. Reuse the two
health routes only when their documented responses match your operational
contract.

Express request objects, response objects, and middleware are not Fastify
handlers. Separate route logic from Express and call it from a Fastify handler,
or keep the Express route behind your existing proxy while you migrate it. Em
See Pea does not provide a generic Express adapter.

### Metrics and observability: adapt separately

Keep an application metrics collector and its existing `/metrics` response in
application code. Register the route on the returned Fastify application and
retain its external route contract. The Express handler itself still needs the
route adaptation described above.

Use Em See Pea's observability extensions for framework MCP request metrics,
traces, or structured logs. Those extensions receive only framework-created,
redacted events. They do not receive request or response bodies, headers,
arguments, results, tokens, URLs, or raw errors. Do not use an operational route
adapter to bypass that boundary.

### Local stdio transport: unsupported

Em See Pea serves MCP over Streamable HTTP. It does not provide the standard
input/output (stdio) transport. Keep the existing stdio process for clients that
still require it, or move those local clients to the HTTP endpoint before
switching off the old server. Adding stdio to the core runtime is outside the
current supported scope.

## What Em See Pea can take over

- Handling MCP requests over Streamable HTTP.
- Describing and listing the tools you register.
- Checking tool input and output against your schemas.
- Checking a connected service's data before it reaches a tool's caller.
- Applying time limits, cancellation, safe error responses, and authentication.
- Sending progress updates on supported tool calls.

You may already have a small implementation of these features. Migration may
not save enough work to justify changing it. Try the testing package first if
your immediate problem is wrong tool choices or incorrect AI explanations.

## What stays yours

Your application still owns its business rules, data mappings, and backend
calls. It must verify token authenticity and decide which people may access
which records or organisations.

Em See Pea does not understand your accounting, lending, or other domain rules
for you. It can validate the shape of a response; your tests must check what
the response means.

## Try one tool before migrating the server

1. Record how one existing read-only tool behaves, including errors and who may use it.
2. Keep those checks, and add an AI tool-choice test for an important edge case.
3. Implement that tool in a separate Em See Pea trial server.
4. Run the same checks against both implementations.
5. Compare the code you can remove with the code and dependencies you would add.

Use [the tool server example](https://github.com/emseepea/emseepea/tree/main/examples/tool-server)
when your handler can return the public result directly. Use
[the API-backed server example](https://github.com/emseepea/emseepea/tree/main/examples/api-backed-server)
when the connected service uses a different input or output format.

## Check compatibility before switching

Em See Pea is pre-alpha and implements part of MCP `2026-07-28`. Check your
clients, published schemas, metadata, and any ChatGPT widgets explicitly.
Do not assume they will behave identically after a framework change.

Keep end-to-end client journeys. Em See Pea can test whether its configured
model selects the expected tool, but it cannot prove that every deployed client,
model, prompt, and permission configuration will make the same choice.

Read the [current feature boundaries](https://github.com/emseepea/emseepea/blob/main/docs/protocol-coverage.md)
before committing to a migration. Keep your existing implementation until the
replacement passes the checks your application relies on.
