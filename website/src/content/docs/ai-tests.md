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
- `eval/` holds native language-model behaviour tests. Tool examples check
  selection and result meaning. Resource and prompt examples can check only a
  real native client journey.
  Run them with `npm run test:llm`.

The commands do not run each other's tests. Both directories are linted.
Organize larger suites into subdirectories, such as `eval/inventory/`.
The LLM runner finds every `*.test.mjs` file inside `eval/`.

## Write an LLM Test

Use Node's test runner and import the conversation helpers from
`@emseepea/testing/semantic`. Start with the
[pea catalogue conversation](https://github.com/emseepea/emseepea/blob/main/examples/api-backed-server/eval/meaning.test.mjs)
or the
[shared report conversation](https://github.com/emseepea/emseepea/blob/main/examples/multi-instance-postgres-server/eval/meaning.test.mjs).

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

Use `assertOptionalToolCall(turn, "submit-feedback")` only for a deliberately
unsuccessful journey where feedback is valid but not required. It accepts no
call or one feedback call, while rejecting duplicate feedback and every other
tool. Successful journeys should instead use exact tool assertions and
`assertNoNegativeFeedback`.

The optional `context` setting represents real application context. It is absent
by default so test guidance cannot bias the model. Use it only when the deployed
application supplies the same context.

The runner sends each user message unchanged through one provider-native MCP
conversation. It does not add selection instructions, a JSON call plan,
advertised-tool text, an answer wrapper, or prepared MCP material. The native
client discovers the server's advertised tool names, descriptions, and input
schemas. Follow-up messages stay in the same conversation.

The provider is connected to exactly one loopback MCP server and may use only
that server's advertised tools. Shell, filesystem, browser, tool search,
plugins, ambient MCP servers, and unrelated tools are unavailable. Native calls
run before the assertions. Use only an isolated, effect-safe test server with
test data. Do not point semantic tests at production.

A zero-call turn is valid when the answer comes from established conversation
history or when no advertised tool is appropriate.

Resources and prompts are selected by users through client features rather than
autonomously called as tools. Give them deterministic protocol tests. Do not
manually inject their content into a semantic test or claim that doing so proves
a native user journey.

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

For a server with protected access, set `authTokenEnvironment` to the name of
an environment variable containing its test access token. Do not put real
tokens in test files. The optional `environment` object supplies ordinary test
settings to the server; model-provider credentials are not passed through.

## What a Passing Check Means

For each test, the runner makes three fresh attempts. Each attempt records the
provider's native MCP tool names and arguments and the response from the real
MCP server. Follow-up turns retain the actual history from the same attempt.

Each `assertResponseMeaning` call gets three independent model judgments. With
three fresh attempts, that is nine judgments for each meaning assertion.
A wrong selection, rejected call, failed literal assertion, rejected meaning, or
missing MCP operation fails the test. Failed attempts are not retried or taken
from a cache.

The conversation model has no shell, files, browser, tool search, plugins,
ambient MCP servers, or unrelated tools. It has one native connection to the
target loopback MCP server. This proves native selection for the configured
provider, model, server, and question, not identical behaviour in every client
or deployment.

Results are saved to `artifacts/llm-eval/evidence.json`. The report contains
readable test prompts, assistant responses, advertised MCP tool calls and
arguments, model-visible tool results, expected meanings, every judge reason,
and hashes. A failed meaning assertion records all nine judgments before
failing, so the artifact shows disagreement without a rerun.

Failed answer and judge invocations record a safe cause such as a timeout,
process exit code, missing result event, or fixed provider error category. The
failed answer trial is identified even when earlier trials completed.

Treat test conversations as publishable artifact content. Use synthetic,
non-sensitive fixtures and never put credentials or production data in prompts,
tool arguments, tool results, assertions, or application context.

Provider events, MCP addresses, configuration, headers, provider and harness
credentials, environment values, stderr, and home-directory paths are not
retained. Secrets placed inside test content are not detected or redacted.
Local evidence is written with mode `0600`; repository CI retains it for 14
days.

Repository tests also use a simulated model to check the runner without spending
model credits. Those `--smoke` checks test the wiring only. They do not prove
that a real model understands the result and cannot approve a release.
