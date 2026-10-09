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
  assertNoNegativeFeedback,
  assertResponseContains,
  assertResponseMeaning,
  assertToolCallsWithOptionalFeedback,
  createConversation,
} from "@emseepea/testing/semantic";

test("searches once and remembers the result", async (t) => {
  const chat = await createConversation(t, {
    server: new URL("../dist/server.js", import.meta.url),
  });

  const search = await chat.send('Search the catalogue for "pea".');
  await assertToolCallsWithOptionalFeedback(search, [{
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
  assertNoNegativeFeedback(search, followUp);
});
```

`assertToolCallsWithOptionalFeedback` checks the complete ordered primary call
list and arguments, then allows no feedback call or one trailing
`submit-feedback` call. Await it. When feedback is present, it requires a
successful tool result and semantically checks that the response openly states
the specific observation.

Pair it with `assertNoNegativeFeedback` so legitimate positive feedback does
not make the primary behavior fail. The disclosure check costs three judge
calls for each feedback-bearing trial, with no extra calls when feedback is
absent and a maximum of nine across the three trials.

Use `assertToolCalls` when no feedback tool is advertised. `assertNoToolCalls`
checks that a turn used the existing conversation without making another call.
`assertResponseContains` accepts literal strings only. Put alternative wording
and numerical meaning in `assertResponseMeaning`.

Use `assertOptionalToolCall(turn, "submit-feedback")` only for a deliberately
unsuccessful journey where feedback is valid but not required. It accepts no
call or one feedback call, while rejecting duplicate feedback and every other
tool. Successful journeys should instead use
`assertToolCallsWithOptionalFeedback` and `assertNoNegativeFeedback`.

The optional `context` setting represents real application context. It is absent
by default so test guidance cannot bias the model. Use it only when the deployed
application supplies the same context.

The runner sends each user message unchanged through one provider-native MCP
conversation. It does not add selection instructions, a JSON call plan,
advertised-tool text, an answer wrapper, or prepared MCP material. The native
client discovers the server's advertised tool names, descriptions, and input
schemas. Follow-up messages stay in the same conversation.

To verify application-owned saved state without carrying model transcript
context, start a fresh provider conversation against the same running test
application:

```js
await chat.fresh();
const recalled = await chat.send("What did I save earlier?");
```

The next `send` creates a new native provider session in every trial. The three
trial applications remain isolated from one another.

Native conversations have no framework tool-call count limit. Existing time,
token, output-size, and provider execution limits remain effective. Claude
allows at most four provider rounds; a round can contain several tool calls.
Removing the call-count limit does not extend that round allowance. Exact
application assertions still decide which calls and results are acceptable.

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

## Qualify the MCP protocol journey

Use the separate `emseepea-qualify` command when you need repeatable MCP checks
without a language model or browser. It can verify protected-resource metadata,
catalogues, templates, authorized reads, original byte hashes, tool-returned
resource links, progress, completion, client cancellation, and access denial.

Define the endpoint and exact expectations in a project-owned module. Scenario
modules are trusted application code. Importing one executes it with the
command process's full authority, including access to that process's
environment.

```js
import { defineMcpCliQualification } from "@emseepea/testing";

export default defineMcpCliQualification({
  name: "synthetic document journey",
  endpoint: new URL(process.env.TEST_MCP_URL),
  tokenEnvironment: "TEST_MCP_TOKEN",
  checkpoints: [
    { id: "tools", operation: "tools/list", expectedNames: ["get-document"] },
    {
      id: "original",
      operation: "resources/read",
      uri: "fixture://documents/example.pdf",
      expectedContents: [{
        mimeType: "application/pdf",
        bytes: 1240,
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }],
    },
  ],
});
```

Expose the command through a project-local package script:

```json
{
  "scripts": {
    "qualify:mcp": "emseepea-qualify --scenario test/mcp-qualification.mjs --output artifacts/mcp-cli/evidence.json"
  }
}
```

Then run the script:

```sh
npm run qualify:mcp
```

The framework reads configured tokens from the named environment variables. It
does not accept them as command arguments or include values it handles in its
report. Trusted scenario code keeps normal process access and is responsible
for anything it reads or writes.

The report retains bounded metadata and hashes rather than resource bytes,
arguments, credentials, headers, endpoint addresses, or private identities.
Each checkpoint is `passed`, `failed`, `blocked`, or `incomplete`. Local
evidence is mode `0600` where supported.

The report is explicitly MCP/CLI evidence. It does not prove ChatGPT connection
or consent screens, attachment handling, fresh-conversation behavior, Sources
previews, visible images, link opening, MCP App rendering, viewport behavior, or
native streaming and cancellation presentation.

## Run the Checks

In a copied example, install its dependencies and run:

```sh
npm test
npm run lint
npm run test:llm
```

The default provider requires the Claude CLI on your command path and a
signed-in Claude account. If needed, run `claude auth login` first. This package
does not bundle a model CLI or copy login credentials.

Run the same scenarios with Codex CLI by selecting the provider and model:

```sh
EMSEEPEA_CODEX_MODEL=gpt-5.5 npm run test:llm -- --provider codex-local
```

`codex-local` uses the current Codex CLI sign-in. The harness links that sign-in
into a temporary Codex home, ignores user configuration and rules, configures
only the loopback test MCP server, disables web search and multi-agent tools,
pre-approves only its discovered tools, and uses a read-only sandbox.

Follow-up turns use `codex exec resume` with the exact session identifier
returned by the first turn.

For CI, store an OpenAI API key in the CI secret store as `OPENAI_API_KEY` and
run:

```sh
EMSEEPEA_CODEX_MODEL=gpt-5.5 npm run test:llm -- --provider codex-ci
```

Do not place the key in repository configuration or command arguments. Missing
or rejected authentication fails the evaluation. Choose a model available to
the account and keep the value stable for comparable evidence.

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

The Claude conversation model has no shell, files, browser, tool search,
plugins, ambient MCP servers, or unrelated tools. Codex uses an isolated
command policy that denies shell launches, an empty shell environment, a
read-only sandbox, ignored user configuration, disabled web and multi-agent
features, and exactly one configured MCP server. Any non-target tool event also
fails the test.

This proves native selection for the recorded provider,
configured model, CLI version, settings, server revision, and question. Codex
evidence labels the model as configured because the JSON event stream does not
identify the resolved model; Claude evidence validates the model from provider
events.

Codex CLI evidence proves the Codex CLI journey only. It does not prove native
ChatGPT plugin discovery, OAuth connection, attachment handling, saved-state
retrieval in ChatGPT, or MCP App card rendering.

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
