# `@emseepea/testing`

Test whether an AI selects the right MCP tool and understands its result, not
just whether the server returns valid data. Write JavaScript tests with ordinary
imports, setup hooks, loops, and assertions.

Read the [guide to testing AI tool choice and understanding](https://github.com/emseepea/emseepea/blob/main/website/src/content/docs/ai-tests.md)
for setup, test fields, commands, and what a passing check proves.

Start from the [pea-variety tool-selection test](https://github.com/emseepea/emseepea/blob/main/examples/tool-server/eval/meaning.test.mjs).
Keep these tests in `eval/`, separate from ordinary tests in `test/`.

Use `toolSelectionTest` when the AI should choose a tool. Use `semanticTest`
when test code deliberately prepares MCP resources, prompts, or several results
for the AI to interpret.
