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

## Diagnose Failures

The evidence file contains readable test prompts, assistant responses,
advertised MCP tool calls and arguments, model-visible tool results, expected
meanings, and judge reasons. It also keeps hashes for comparison. A failed
meaning assertion runs and records all nine judgments, so disagreement is
visible without a rerun.

Treat test conversations as publishable artifact content. Use synthetic,
non-sensitive fixtures and never put credentials or production data in prompts,
tool arguments, tool results, assertions, or application context.

Provider events, MCP addresses, configuration, headers, provider and harness
credentials, environment values, stderr, and home-directory paths are not
retained. Secrets placed inside test content are not detected or redacted.
Local evidence is written with mode `0600`; repository CI retains it for 14
days.
