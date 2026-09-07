# `@emseepea/testing`

Test whether an AI selects the right MCP tool and understands its result, not
just whether the server returns valid data. Write JavaScript tests with ordinary
imports, setup hooks, loops, and assertions.

Read the [guide to testing AI tool choice and understanding](https://github.com/emseepea/emseepea/blob/main/website/src/content/docs/ai-tests.md)
for setup, test structure, commands, and what a passing check proves.

Start from the [pea-variety conversation test](https://github.com/emseepea/emseepea/blob/main/examples/tool-server/eval/meaning.test.mjs).
Keep these tests in `eval/`, separate from ordinary tests in `test/`.

Use `createConversation` inside an ordinary `node:test` test. Send one or more
user prompts, then assert exact tool calls and response meaning with the exported
semantic assertions.

The runner sends each prompt unchanged through one provider-native MCP
conversation. It does not add tool-selection instructions, a JSON call plan,
advertised-tool text, an answer wrapper, or prepared MCP material. Exact tool
assertions come from the provider's native MCP events. Follow-up messages use
the same conversation.

Optional `context` is application context, not test guidance. Use it only when
the deployed application supplies the same context. Leaving it out is the best
default for testing whether tool names, descriptions, and schemas stand on
their own.

Point semantic tests only at isolated, effect-safe test servers and fixtures,
never production. Resources and prompts need deterministic protocol tests;
this library does not pretend that manually injecting their content proves a
native user journey.
