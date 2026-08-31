# `@emseepea/testing`

Test whether an AI understands your MCP server's results, not just whether
the server returns valid data. Write the checks in JavaScript, with ordinary
imports, setup hooks, loops, and assertions.

The code-first API below is being prepared for the next package release.

## Keep the Two Kinds of Test Separate

Each example has two directories:

- `test/` holds ordinary tests. Run them with `npm test`.
- `eval/` holds tests that ask a language model to interpret MCP results.
  Run them with `npm run test:llm`.

The commands do not run each other's tests. Both directories are linted.
Organize larger suites into subdirectories, such as `eval/inventory/`.
The LLM runner finds every `*.test.mjs` file inside `eval/`.

## Write an LLM Test

Import `semanticTest` from `@emseepea/testing/semantic` in a file such as
`eval/coffee.test.mjs`. Start with the
[basic coffee test](https://github.com/windyroad/emseepea/blob/main/examples/basic-no-ui/eval/meaning.test.mjs)
or the
[report test with repeated calls](https://github.com/windyroad/emseepea/blob/main/examples/multi-instance/eval/meaning.test.mjs).

Each test describes:

- `server`: the file URL of your built server entry point. It must print its
  local `http://127.0.0.1:PORT/mcp` address when ready.
- `exercise`: code that calls tools, reads resources, or requests prompts
  through the supplied MCP client. Use assertions to check the returned data.
- `question`: what to ask the model about those results.
- `criticalFacts`: text or regular expressions that every answer must match.
  Text checks ignore letter case; patterns use their own flags.
- `criteria`: what a correct answer must mean, including mistakes to avoid.
- `requiredPaths`: which MCP operations must supply the evidence, written as
  `method:target`, such as `tools/call:get-bean-details`.

Use the optional `assertAnswer(answer)` callback for your own exact checks on
the model's answer. Each test needs a unique name within its file.

The repeated-report example asks for JSON and checks every field; it does not
test free-form prose.

The callback's client supports `callTool`, `readResource`, and `getPrompt`.
Pass request parameters as the single argument to each method. The helper
records every call and includes tool progress in the model's input.

## Run the Checks

In a copied example, install its dependencies and run:

```sh
npm test
npm run lint
npm run test:llm
```

The last command requires the Claude CLI on your command path and a signed-in
Claude account. If needed, run `claude auth login` first. This package does not
bundle the CLI or copy your login credentials.

For your own project, add `@emseepea/testing` as a development dependency and
set `test:llm` to build your server and run `emseepea-test eval`.

For a server that requires sign-in, set `authTokenEnvironment` to the name of
an environment variable containing its test access token. Do not put real
tokens in test files. The optional `environment` object supplies ordinary test
settings to the server; model-provider credentials are not passed through.

## What a Passing Check Means

For each test, the runner asks the same question three times. Each answer gets
three independent model judgments, for nine judgments in total. A missing
fact, failed assertion, rejected answer, or missing MCP call fails the test.
Failed answers are not retried or taken from a cache.

Your test code makes the MCP calls. The model interprets the collected results;
it cannot call tools itself. These checks prove interpretation of that material,
not that the model can independently choose the right tool.

Results are saved to `artifacts/llm-eval/evidence.json`. The report contains
outcomes and operation hashes, not raw MCP results or model answers.

Repository tests also use a simulated model to check the runner without spending
model credits. Those `--smoke` checks test the wiring only. They do not prove
that a real model understands the result and cannot approve a release.
