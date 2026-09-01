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

Copy a small, tested example and make it yours. Start with one useful tool,
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
- Tools that require sign-in, while their names and descriptions remain public.
- Reference material and reusable prompts for assistants.
- Tools that send progress updates while they work.
- Optional web forms, using native HTML or React.

[Choose an example](./examples/) that matches what you want to build.

## Test the choice and meaning, not just the response

A response can contain all the right fields and still lead to a wrong answer.
An assistant might confuse money available to spend with money owed, or a
payment received with a payment matched to an invoice.

Em See Pea lets you describe the expected tool and meaning in a JavaScript test.
The model chooses from your server's advertised tools. The test runs the chosen
call against your server, then checks whether the model understands the result.
Keep these tests in `eval/`, separate from ordinary tests in `test/`.

[Write an AI tool-choice test](./ai-tests/).

## Before you start

Em See Pea is pre-alpha. It uses Fastify and Node.js 22 or 24, and supports
part of MCP `2026-07-28`, not the entire protocol.

The guides distinguish packages you can install from examples that currently
need this repository's source. The framework and examples are open source
under the [MIT licence](https://github.com/emseepea/emseepea/blob/main/LICENSE).
