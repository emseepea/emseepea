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

## What Em See Pea can take over

- Handling MCP requests over Streamable HTTP.
- Describing and listing the tools you register.
- Checking tool input and output against your schemas.
- Checking a connected service's data before it reaches a tool's caller.
- Applying time limits, cancellation, safe error responses, and sign-in hooks.
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

Use [the basic example](https://github.com/emseepea/emseepea/tree/main/examples/basic-no-ui)
when your handler can return the public result directly. Use
[the backend example](https://github.com/emseepea/emseepea/tree/main/examples/backend-no-ui)
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
