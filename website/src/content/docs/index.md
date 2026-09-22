---
title: Build tools AI can use correctly
description: Create MCP servers and test whether AI chooses the right tools and understands their results.
---

Em See Pea helps you build tools that AI assistants can use through the
Model Context Protocol (MCP). It handles the server, checks incoming data,
and checks the results your tools return.

Correct data is only half the job. Its testing package checks whether a
language model chooses the right tool and explains the result correctly.

## What do you want to do?

### Build a new MCP server

Create a small, tested starter and make it yours. Start with one useful tool,
then add the capabilities you need.

[Get your first server running](./getting-started/).

### Test an existing MCP server

Keep your server. Add tests that check whether a model chooses the expected
tool and understands its result.

[Add AI tool-choice and understanding tests](./ai-tests/).

### Maintain less server code

Find out which transport, validation, and request-handling code Em See Pea can
take over, and which application responsibilities remain yours.

[Plan a server migration](./less-server-code/).

## What you can create

- Tools that answer questions using your data or another service.
- Protected capabilities with public discovery by default, or explicit permission-shaped discovery.
- Reference material and reusable prompts for assistants.
- Tools that send progress updates while they work.
- Optional detailed feedback and durable support conversations.
- Optional web forms, using native HTML or React.

[Choose an example](./examples/) that matches what you want to build.

[Add feedback](./feedback/) after choosing the application shape.

## Test the choice and meaning, not just the response

A response can contain all the right fields and still lead to a wrong answer.
An assistant might confuse money available to spend with money owed, or a
payment received with a payment matched to an invoice.

Em See Pea lets you describe the expected tool and meaning in a JavaScript test.
The model chooses from your server's advertised tools. The test runs the chosen
call against your server, then checks whether the model understands the result.
Keep these tests in `eval/`, separate from ordinary tests in `test/`.

[Write an AI tool-choice test](./ai-tests/).

## Maturity and support

Em See Pea is beta. Here, beta means exactly this:

- The MCP capabilities named below are usable and verified end to end.
- Versions below 1.0 may still introduce breaking changes.
- Only the newest version published under the npm `latest` tag is eligible for security fixes.
- There is no production-support promise, no backport promise, and no response-time promise.

The active revision is MCP `2026-07-28` over Streamable HTTP. One stateless
endpoint also accepts a verified compatibility subset of `2025-11-25`,
`2025-06-18`, `2025-03-26`, `2024-11-05`, and `2024-10-07`: initialization,
tool listing, and tool invocation.

Two optional capabilities are not
implemented: list-change notifications within one running process and a
generic extension-notification registration point. MCP Sampling is
intentionally absent because the
active revision deprecates it. Read the
[protocol coverage ledger](https://github.com/emseepea/emseepea/blob/main/docs/protocol-coverage.md)
for the evidence and boundaries.

The packages support Node.js 22 or newer. Four starters require Node.js
22.13.0 or newer. Continuous integration (CI) exercises Node.js 22 and 24;
those are tested versions,
not the complete support range.

## Before you start

The starter commands use npm's default release channel. The framework and examples
are open source under the
[MIT licence](https://github.com/emseepea/emseepea/blob/main/LICENSE).
