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

Use Node's test runner and import the conversation helpers from
`@emseepea/testing/semantic`. Start with the
[pea catalogue conversation](https://github.com/emseepea/emseepea/blob/main/examples/api-backed-server/eval/meaning.test.mjs)
or the
[report test with repeated calls](https://github.com/emseepea/emseepea/blob/main/examples/multi-instance-sqlite-server/eval/meaning.test.mjs).

```js
import test from "node:test";
import {
  assertNoToolCalls,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCalls,
  createConversation,
} from "@emseepea/testing/semantic";

test("searches once and remembers the result", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });

  const search = await chat.send('Search the catalogue for "pea".');
  assertToolCalls(search, [{
    name: "search-pea-taxa",
    arguments: { query: "pea" },
  }]);
  assertResponseContains(search, "Pisum sativum");
  await assertResponseMeaning(search, {
    expected: "Pisum sativum has the most recorded observations.",
  });

  const followUp = await chat.send("What was its common name?");
  assertNoToolCalls(followUp);
  assertResponseContains(followUp, "Common Pea");
});
```

`assertToolCalls` checks the complete ordered call list, including arguments and
call count. `assertNoToolCalls` checks that a turn used the existing conversation
without making another call. `assertResponseContains` accepts literal strings
only. Put alternative wording and numerical meaning in `assertResponseMeaning`.

The optional `context` setting represents real application context. It is absent
by default so test guidance cannot bias the model. For resources and prompts,
use `chat.prepare` with `readResource` or `getPrompt` before sending the user
message.

The model receives the advertised tool names, descriptions, input schemas, and
the actual history from its own trial. It chooses zero to three calls as strict
JSON. The harness rejects unknown, over-limit, or malformed selections, then
executes accepted calls through the official MCP client.

Those calls run before the assertions. Use only an isolated, effect-safe test
server with test data. Do not point semantic tests at production.

A zero-call plan is valid when the expected answer comes from established
conversation history or prepared MCP material.

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

For each test, the runner makes three fresh attempts. Each attempt checks the
model's selected tool names and arguments, then runs accepted calls through the
real MCP server. Follow-up turns retain only the actual history from the same
attempt.

Each `assertResponseMeaning` call gets three independent model judgments. With
three fresh attempts, that is nine judgments for each meaning assertion.
A wrong selection, rejected call, failed literal assertion, rejected meaning, or
missing MCP operation fails the test. Failed attempts are not retried or taken
from a cache.

The selection model has no shell, files, browser, arbitrary network access, or
native MCP connection. It chooses from the server's advertised public tool
contracts; the harness validates and executes that choice. This proves selection
for the configured model and question, not identical behaviour in every client
or deployment.

Results are saved to `artifacts/llm-eval/evidence.json`. The report contains
outcomes and hashes for prompts, calls, material, answers, and judgments, not
their raw private content.

Repository tests also use a simulated model to check the runner without spending
model credits. Those `--smoke` checks test the wiring only. They do not prove
that a real model understands the result and cannot approve a release.
