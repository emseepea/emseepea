---
title: Test tool choice and result meaning
description: Check whether AI selects the right MCP tool and understands its result.
---

Test whether an AI chooses the right MCP tool and understands the result, not
just whether the server returns valid data. Write the checks in JavaScript,
with ordinary imports, setup hooks, loops, and assertions.

## Use it with your existing server

`@emseepea/testing` does not depend on the Em See Pea server package. You can
keep your current server and try one AI tool-choice test before considering a
framework migration.

The current runner starts a Node.js entry point and connects to the local
Streamable HTTP address it prints. It uses MCP `2026-07-28`. Your server must
support that version; this is not a compatibility promise for older servers
or every ChatGPT widget.

Start with one choice or result where a plausible mistake would matter. Check
that a loan assistant selects the repayment tool rather than an approval tool,
then distinguishes a lender's assessment rate from the rate used to estimate
actual repayments. For accounting, check that it selects the right report and
then treats an overdraft as reducing cash available to spend.

These checks supplement your existing tests. They do not replace real ChatGPT
or Codex journeys, or checks of permissions and business rules.

## Keep the Two Kinds of Test Separate

Each example has two directories:

- `test/` holds ordinary tests. Run them with `npm test`.
- `eval/` holds tests that ask a language model to select tools and interpret
  MCP results.
  Run them with `npm run test:llm`.

The commands do not run each other's tests. Both directories are linted.
Organize larger suites into subdirectories, such as `eval/inventory/`.
The LLM runner finds every `*.test.mjs` file inside `eval/`.

## Write an LLM Test

Import `toolSelectionTest` from `@emseepea/testing/semantic` in a file such as
`eval/coffee.test.mjs`. Start with the
[basic coffee test](https://github.com/windyroad/emseepea/blob/main/examples/basic-no-ui/eval/meaning.test.mjs)
or the
[report test with repeated calls](https://github.com/windyroad/emseepea/blob/main/examples/multi-instance/eval/meaning.test.mjs).

Each test describes:

- `server`: the file URL of your built server entry point. It must print its
  local `http://127.0.0.1:PORT/mcp` address when ready.
- `question`: what to ask the model about those results.
- `expectedTools`: the exact tool sequence the model must select. Use the same
  name twice when the question requires two calls to one tool.
- `criticalFacts`: text or regular expressions that every answer must match.
  Text checks ignore letter case; patterns use their own flags.
- `criteria`: what a correct answer must mean, including mistakes to avoid.

Use the optional `assertAnswer(answer)` callback for your own exact checks on
the model's answer. Each test needs a unique name within its file.

The repeated-report example asks for JSON and checks every field; it does not
test free-form prose.

The model receives the advertised tool names, descriptions, and input schemas.
It chooses one to three calls as strict JSON. The harness rejects missing,
unknown, extra, or malformed selections, then executes accepted calls through
the official MCP client. The model sees the returned material in a separate
answer step.

Use `semanticTest` when test code must prepare resources, prompts, or a custom
set of results. Its `exercise` callback supports `callTool`, `readResource`, and
`getPrompt`; `requiredPaths` states which operations must supply the evidence.

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

For each test, the runner makes three fresh attempts. In a tool-selection test,
each attempt first checks the model's selected tool names and arguments, then
runs those calls through the real MCP server.

Each answer gets three independent model judgments, for nine judgments in total.
A wrong selection, rejected call, missing fact, failed assertion, rejected answer,
or missing MCP call fails the test. Failed attempts are not retried or taken from
a cache.

The selection model has no shell, files, browser, arbitrary network access, or
native MCP connection. It chooses from the server's advertised public tool
contracts; the harness validates and executes that choice. This proves selection
for the configured model and question, not identical behaviour in every client
or deployment.

Results are saved to `artifacts/llm-eval/evidence.json`. The report contains
outcomes and operation hashes, not raw MCP results or model answers.

Repository tests also use a simulated model to check the runner without spending
model credits. Those `--smoke` checks test the wiring only. They do not prove
that a real model understands the result and cannot approve a release.
