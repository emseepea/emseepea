# `@emseepea/testing`

Em See Pea is beta. [Maturity and support](https://github.com/emseepea/emseepea/blob/main/SUPPORT.md#maturity-and-support)
defines the limits of that label.

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

Use `assertToolNames` when one tool has intentionally free-form arguments. Pair
it with `assertToolArguments` for the stable call and `assertFeedback` for the
feedback observation and important detail. Keep `assertToolCalls` when every
complete argument should match exactly and no feedback tool is advertised.

For an intentionally optional permission check, use
`assertToolNames(turn, { oneOf: [["update"], ["permissions", "update"]] })`.
Supply one to eight explicit sequences. Each trial must match a complete
sequence in the listed order and count. The evidence retains all alternatives
and the matched sequence; arguments, meaning, confirmation and feedback still
need their own assertions.

Use `assertToolSelection` when valid tool order or recovery paths can vary, but
the permitted tools and call counts are bounded. Its tool-selection contract
lists required, allowed, and explicitly forbidden tools. Any advertised tool
that is not required or allowed is rejected.

```js
assertToolSelection(turn, {
  required: [
    { name: "list-candidates", minCalls: 1, maxCalls: 1 },
    { name: "commit-selection", minCalls: 1, maxCalls: 1 },
  ],
  allowed: [{ name: "lookup-candidate", maxCalls: 2 }],
  forbidden: [],
  totalCalls: { minCalls: 2, maxCalls: 4 },
});
```

The finite maximums are checked after the turn. They do not stop tool calls or
truncate evidence.

A passing selection assertion proves only that every
recorded call satisfied the declared tool and count rules. It does not prove
argument correctness, persisted effects, response meaning, or recovery from an
error. Keep an exact assertion when order, count, and arguments are
deterministic, and add the separate assertions your application outcome needs.

Each turn also exposes `toolOutcomes`, aligned by trial and call order with
`toolCalls`. Each outcome is a read-only snapshot of what the model saw. It
contains only `name`, `arguments`, the model-visible `result`, and `isError`.
Use it to check an expected error and the later calls that followed the error.
A later non-error result does not by itself prove recovery or a persisted
effect.

For a successful turn that advertises feedback, use
`assertToolCallsWithOptionalFeedback`. It requires the exact ordered primary
calls and arguments, then allows no feedback call or one trailing
`submit-feedback` call. When feedback is present, it also requires a successful
tool result and semantically checks that the response openly states the
specific observation. Await this assertion.

Pair it with `assertNoNegativeFeedback` so legitimate positive feedback does
not make the primary behavior fail. Disclosure costs three judge calls for each
feedback-bearing trial, with no extra judge calls when feedback is absent and a
maximum of nine across the three trials.

Use `assertOptionalToolCall(turn, "submit-feedback")` only for a deliberately
unsuccessful journey where feedback is valid but not required. It accepts no
call or one feedback call and rejects duplicate feedback or any other tool.

For a successful application journey that advertises `submit-feedback`, call
`assertNoNegativeFeedback(...turns)` once after its normal assertions. It fails
if the AI records an error, friction, annoyance, unnecessary difficulty,
confusion, repetition, an unexpected bad result, or a capability mismatch. The
evidence records both the expectation and any offending call.

The runner sends each prompt unchanged through one provider-native MCP
conversation. It does not add tool-selection instructions, a JSON call plan,
advertised-tool text, an answer wrapper, or prepared MCP material. Exact tool
assertions come from the provider's native MCP events. Follow-up messages use
the same conversation.

Native conversations have no framework tool-call or native provider-turn count
limit. Calls must still use advertised MCP tools. The per-send timeout,
cancellation, output checks, model checks, and isolated test environment remain
effective. Application assertions decide which calls and results are
acceptable. Tool-free judge invocations retain their existing limits.

Call `await conversation.fresh()` to discard provider transcript history while
keeping the same running test application and its saved data. The next `send`
starts a new provider-native session in each trial.

The runner supports `claude-local`, `claude-ci`, `codex-local`, and `codex-ci`.
Codex providers require an explicit `EMSEEPEA_CODEX_MODEL`. For example:

```sh
EMSEEPEA_CODEX_MODEL=gpt-5.5 emseepea-test --provider codex-local eval
```

`codex-local` uses the existing Codex CLI sign-in without copying it.
`codex-ci` requires `OPENAI_API_KEY` from the CI secret store. Both providers
record the installed CLI version as provenance, run `codex exec --json`, resume the actual
Codex session for follow-ups, ignore user configuration, and pre-approve only
the discovered tools from the test server.

CLI eligibility is established by the invocation and event contracts rather
than a version cutoff. An unsupported invocation or invalid, incomplete or
forbidden event still fails qualification.

An isolated command policy denies shell launches and spawned shell environments
inherit no provider credentials. The runner also disables Codex account apps,
plugins, remote plugins, multi-agent execution, web search, shell tools, and
unified execution for each one-shot and resumed native invocation.

The isolated model process preserves configured proxy and certificate-trust
settings so authentication works on managed networks. These transport settings
do not enable shell tools or inherit unrelated service credentials.

The invocation configuration sets the default account-app state to disabled,
omits account-app instructions, and disables Codex app, plugin, and tool
suggestion features.

Native-client events are authoritative for the tools that were actually used:
a turn is accepted only when every application MCP call belongs to the
configured test server and its expected tools.

Codex may make its two built-in resource-discovery calls through the CLI's
`codex` server. The runner accepts them only when their native results prove the
resource and template inventories are empty, and excludes them from application
assertions and raw evidence.

Any non-empty, unrecognised, account-app, plugin, or other foreign call is
rejected without storing raw account metadata.

Failed Codex runs retain only a fixed failure category: authentication,
configuration, host storage, permission or sandbox, provider, transport, or
unknown. The runner inspects at most 32 KiB of standard error to derive that
category and does not store the standard error.

Rejected native items retain only capped counts from a fixed item-type list.
Commands, arguments, results, paths, server and tool names, and unknown
item-type strings are excluded.

Codex CLI evidence proves that CLI journey. It does not prove native ChatGPT
connection, attachment, retrieval, or MCP App rendering behavior.

Optional `context` is application context, not test guidance. Use it only when
the deployed application supplies the same context. Leaving it out is the best
default for testing whether tool names, descriptions, and schemas stand on
their own.

Point semantic tests only at isolated, effect-safe test servers and fixtures,
never production. Resources and prompts need deterministic protocol tests;
this library does not pretend that manually injecting their content proves a
native user journey.

## Qualify an MCP journey from the command line

Use `emseepea-qualify` for repeatable protocol checks against an explicitly
configured MCP endpoint. The command can verify OAuth protected-resource
metadata, tool and resource catalogues, resource templates, exact authorized
reads, original byte hashes, tool-returned resource links and embedded
resources, progress, completion, client cancellation, and access denial.

Keep the endpoint, fixture values, expected results, and token environment
names in an adopter-owned scenario module. Scenario modules are trusted
application code: importing one executes it with the command process's full
authority, including access to that process's environment.

```js
import { defineMcpCliQualification } from "@emseepea/testing";

export default defineMcpCliQualification({
  name: "synthetic document journey",
  endpoint: new URL(process.env.TEST_MCP_URL),
  tokenEnvironment: "TEST_MCP_TOKEN",
  checkpoints: [
    { id: "tools", operation: "tools/list", expectedNames: ["get-document"] },
    { id: "resources", operation: "resources/list", expectedUris: ["fixture://documents/example.pdf"] },
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
    {
      id: "embedded-original",
      operation: "tools/call",
      name: "get-document",
      expectedResourceLinks: [{
        uri: "fixture://documents/example.pdf",
        mimeType: "application/pdf",
      }],
      expectedEmbeddedResources: [{
        uri: "fixture://documents/example.pdf",
        mimeType: "application/pdf",
        bytes: 1240,
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }],
    },
    {
      id: "limited-user-denied",
      operation: "resources/read",
      uri: "fixture://documents/example.pdf",
      tokenEnvironment: "TEST_LIMITED_MCP_TOKEN",
      expect: "denied",
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

Run the script with:

```sh
npm run qualify:mcp
```

The framework reads configured tokens from the named environment variables. It
does not accept them as command arguments or include values it handles in its
evidence. Your trusted scenario code still has normal process access and is
responsible for anything it reads or writes.

Evidence contains bounded counts, hashes, MIME types, categorical outcomes,
and checkpoint status. It is written with mode `0600` where supported. Use only
synthetic or explicitly approved fixture data in scenario names and
expectations.

Embedded-resource checks inspect only resource content returned by the tool.
They do not dereference its URI or grant access to it. Use a separate
`resources/read` checkpoint to prove authorized retrieval and denial behavior.

Each checkpoint records `passed`, `failed`, `blocked`, or `incomplete`.
`record` checkpoints can preserve a known missing fixture or unavailable
authority without turning it into success. The report is always labelled
`evidenceKind: "mcp-cli"` and `nativeChatgpt: "not-tested"`.

This command does not drive ChatGPT. It cannot prove ChatGPT connection or
consent screens, attachments, fresh-conversation behavior, Sources previews,
visible images, generated links, MCP App cards, viewport interactions, or
native streaming and cancellation presentation.

## Scripted Confirmation Input

For tools that request form elicitation, supply an explicit simulated human
response for that turn. The script answers the real native client's request;
it is not sent to the model and does not replace a tool result.

```js
const turn = await conversation.send("Create a contact named Synthetic Customer.", {
  elicitations: [{
    messageIncludes: ["Create", "Synthetic Customer"],
    response: { action: "accept", content: { decision: "create" } },
  }],
});
assertNoNegativeFeedback(turn);
```

Choose fragments that identify the exact proposed effect and recipient where
applicable. Every fragment must match one actual form request. Unexpected,
ambiguous, duplicate, and unused scripted responses fail the turn. No request
is approved by default; URL elicitation is unsupported.

Each of the three trials records the form message, schema, and scripted human
decision in `turn.elicitations` and saved evidence. This proves the tested
native client exchange with simulated human input, not compatibility with a
different client or a person's actual consent. Continue to use isolated,
synthetic servers; never point these tests at production.

## Test Extension Composition

Use `startEmseepea` in ordinary tests when you have an app factory and want to
exercise it in the same process. `insecureTestAuthentication` supplies a small
test-only verifier for protected-access examples:

```js
import { insecureTestAuthentication, startEmseepea } from "@emseepea/testing";

const running = await startEmseepea(t, await createApp({
  access: { access: "protected", requiredScopes: ["peas:read"] },
  authentication: insecureTestAuthentication(["peas:read"]),
  observability: [{ id: "test", emit: (event) => events.push(event) }],
}), { token: "test-token" });

const client = await running.connect();
```

The test context is optional. Use explicit cleanup with Vitest, Jest, another
runner, or a plain script:

```js
const running = await startEmseepea(await createApp());
try {
  const client = await running.connect();
  // assertions
} finally {
  await running.close();
}
```

`running.close()` is idempotent. It closes every client created by
`running.connect()`, then closes the server or child process. You do not need to
call `client.close()` separately.

In Vitest, register cleanup with `onTestFinished`:

```js
import { startEmseepea } from "@emseepea/testing";
import { it, onTestFinished } from "vitest";

it("serves the expected tools", async () => {
  const running = await startEmseepea(await createApp());
  onTestFinished(() => running.close());

  const client = await running.connect();
  // assertions
});
```

Passing a test context with an `after` hook, as in the first example, registers
the same `close()` operation automatically.

Set `protocolVersion` on `startEmseepea` or `startMcpServer` to test one of the
server's documented protocol revisions. Omitting it keeps the `2026-07-28`
default; for example, `{ protocolVersion: "2025-11-25" }` exercises the legacy
stateless path.

Never deploy `insecureTestAuthentication`. It accepts any supplied bearer token
and exists only to keep ordinary tests focused on composition and authorization
flow. Test a real verifier separately against its provider contract.

## Check a Published MCP Contract

Use the connected client to capture the public contract available with that
client's access. The snapshot includes tool schemas and UI metadata, plus each
listed resource's URI, MIME type, UI metadata, and Content Security Policy
(CSP). Resource bodies are excluded.

```js
import { readFile } from "node:fs/promises";
import {
  assertPublishedMcpContractCompatible,
  extractPublishedMcpContract,
  startEmseepea,
  writePublishedMcpContractBaseline,
} from "@emseepea/testing";
import { createApp } from "./app.js";

const running = await startEmseepea(await createApp());
try {
  const current = await extractPublishedMcpContract(await running.connect());
  if (process.argv.includes("--capture")) {
    await writePublishedMcpContractBaseline("contract-baselines/1.0.0.json", {
      version: "1.0.0",
      contract: current,
    });
  } else {
    const baseline = JSON.parse(await readFile("contract-baselines/1.0.0.json", "utf8"));
    assertPublishedMcpContractCompatible(current, [baseline]);
  }
} finally {
  await running.close();
}
```

`assertPublishedMcpContractCompatible` throws with every concrete breaking or
unclassified change, so an ordinary Node script exits non-zero. Input changes
must continue accepting prior callers. Output changes must remain within the
prior consumer contract. CSP allow-list additions are breaking; removals are
safe. Unknown JSON Schema changes fail closed for review.

Keep the capture version, release policy, baseline location, and retention in
the application repository. Run capture only for a contract that has actually
been published or submitted for review.

For the same comparison without a custom wrapper, add project-local commands:

```json
{
  "scripts": {
    "contract:capture": "emseepea-contract capture --factory ./dist/app.js --factory-export createApp",
    "contract:check": "emseepea-contract check --factory ./dist/app.js --factory-export createApp --baselines contract-baselines"
  }
}
```

Capture a version only when your application policy says it is published:

```sh
npm run contract:capture -- --version 1.0.0 --baseline contract-baselines/1.0.0.json
npm run contract:check
```

Use `--url https://example.com/mcp` instead of `--factory` to inspect an MCP
endpoint. For protected discovery, set the token in an environment variable
and pass its name with `--token-env`; the token value is not accepted as a
command argument or written to output or baselines. Use `--protocol-version`
when the server requires a supported older protocol revision.

Capture exits 0 after writing the requested baseline. Check exits 0 when every
JSON baseline in the directory is compatible, 1 for compatibility failures,
and 2 for invalid options, extraction failures, or invalid baseline files.

When retained baselines need application-owned migration, normalization, or
comparison rules, add one trusted local policy module to `check`:

```json
{
  "scripts": {
    "contract:check": "emseepea-contract check --factory ./dist/app.js --factory-export createApp --baselines contract-baselines --policy ./dist/published-contract-policy.js"
  }
}
```

The module must export `checkPublishedMcpContracts`. It receives the extracted
current contract and each sorted baseline as `{ file, value }`, where `value`
is parsed JSON before the standard baseline-envelope validation. Return
`PublishedMcpContractBreak` records for incompatibilities:

```js
import { comparePublishedMcpContracts } from "@emseepea/testing";

export async function checkPublishedMcpContracts({ current, baselines }) {
  const migrated = baselines.map(({ file, value }) => migrateLegacyBaseline(file, value));
  return comparePublishedMcpContracts(normalize(current), migrated)
    .filter(({ kind }) => kind !== "output-field-added");
}
```

The CLI still discovers and parses baseline files, extracts the current
contract, formats diagnostics, redacts command-managed errors, and chooses exit
status 0, 1, or 2. It validates the returned break records. Without `--policy`,
the existing baseline validation and comparison behavior is unchanged. Capture
does not accept a policy and never rewrites a legacy baseline automatically.

Policy modules are trusted application code, not a sandbox. They run with the
same process authority as the command and can read environment variables,
write files, or write directly to output. The CLI does not pass the bearer
token to the policy input and redacts errors it formats, but it cannot redact
output written directly by policy code.

Custom normalization, legacy migration, stricter comparison rules, baseline
retention, approvals, capture timing, and deployment policy stay in application
code. The policy hook covers only migration, normalization, and comparison;
retention and release decisions remain outside the CLI.

## Check Static Color Contrast

Use `wcagContrastRatio` to measure one opaque solid sRGB color pair. Use
`assertWcagContrast` when a test should fail below its required ratio.

```js
import { assertWcagContrast } from "@emseepea/testing";

assertWcagContrast("#0d0d0d", "#ffffff", 4.5, "body text");
assertWcagContrast("#006a8e", "#ffffff", 3, "focus indicator");
```

For Web Content Accessibility Guidelines (WCAG) 2.2, normal text commonly
requires 4.5:1 under Success Criterion 1.4.3. Large text and non-text boundaries
commonly require 3:1 under Success Criteria 1.4.3 and 1.4.11. Pass the threshold
that applies to the content and state you are testing.

Applications still choose their colors and tested pairs. These helpers accept
opaque `#RRGGBB` colors only. They do not inspect rendered CSS, transparency,
gradients, component states, focus geometry, or forced-colors mode, and they do
not establish WCAG conformance. Test the rendered interface separately.

When a conversation writes to external state, pass an `environment` function
that returns a separate test database connection for each trial. The trial
number selects infrastructure only. It is never sent to the model or MCP
server, and it does not prepare or coach the conversation.

For ordinary integration tests, `startMcpServer(...).output()` returns the
server's captured `stdout` and `stderr`. Use it to prove that logs do not expose
credentials or provider details.

## Simulate an MCP Apps Host

Use `createMcpAppHostSimulator` to test an app controller without creating a
fake parent window or JSON-RPC dispatcher. The simulator has no React, Svelte,
or test-runner dependency.

```js
import assert from "node:assert/strict";
import { createMcpAppController } from "@emseepea/server/ui";
import { createMcpAppHostSimulator } from "@emseepea/testing";

const host = createMcpAppHostSimulator({
  hostContext: { theme: "light", displayMode: "inline" },
});
const controller = createMcpAppController({
  name: "Order result",
  version: "1.0.0",
  parseResult: parseOrderResult,
});

controller.connect(host.channel);
host.deliverToolResult({ orderId: "example-123", status: "ready" });
host.changeHostContext({ theme: "dark" });

const sent = controller.sendMessage("Show the delivery details.");
host.messageRequests()[0].succeed();
await sent;

const rejected = controller.sendMessage("Change the delivery address.");
host.messageRequests()[1].reject("The action needs confirmation.");
await assert.rejects(rejected, /host rejected/i);

host.cancel("user cancelled");
await host.teardown("test complete");

function parseOrderResult(value) {
  if (!value || typeof value !== "object" ||
      typeof value.orderId !== "string" || value.status !== "ready") {
    throw new TypeError("Invalid order result");
  }
  return { orderId: value.orderId, status: value.status };
}
```

Initialization is automatic. `initialized()` shows whether the controller sent
`ui/notifications/initialized`. The app's `parseResult` function remains the
validation boundary for delivered structured content. Use `dispatch()` for a
malformed trusted-parent message and `dispatchUntrusted()` for a message from a
different source when testing that the controller ignores unsafe input.

This deterministic simulation proves the lifecycle behavior that the test
drives, including initialization, result validation, context changes, message
responses, cancellation, and teardown. It does not prove behavior in ChatGPT,
Claude, or another exact host. Qualify each supported host separately through
its real public journey before making a host-specific production claim.

## Run a Compiled MCP App in a Browser

Use `createMcpAppDevelopmentHost` from `@emseepea/testing/browser` in a local
development page. The host creates an iframe, loads the compiled widget, and
uses the same protocol engine as `createMcpAppHostSimulator`.

```js
import { createMcpAppDevelopmentHost } from "@emseepea/testing/browser";

const host = createMcpAppDevelopmentHost({
  container: document.querySelector("#preview"),
  entryPoint: "../dist/order-result.js",
  rootElementId: "order-result-root",
  fixtures: {
    ready: { orderId: "example-123", status: "ready" },
    delayed: { orderId: "example-456", status: "delayed" },
  },
  hostContext: { theme: "light", platform: "web" },
});
```

The first fixture is the default. These URL parameters override it for a local
browser run:

- `fixture=delayed` selects a named fixture.
- `theme=dark` selects the initial light or dark host theme.
- `width=288` constrains the iframe from 200 to 2,000 pixels.
- `motion=reduce` makes the iframe match `prefers-reduced-motion`.
- `message=reject` rejects `ui/message`; the default succeeds.

Use `deliverFixture()`, `changeHostContext()`, and `setContainerWidth()` for
changes without reloading. `messageRequests()` exposes captured action text.
Call `destroy()` when the preview is no longer needed.

Keep fixtures, widget styles, screenshot policy, and assertions in the
application. This development host proves only the browser lifecycle that you
run. It does not establish compatibility with ChatGPT, Claude, or another
public host. Qualify each supported host through its real public journey.

## Diagnose Failures

The evidence file contains readable test prompts, assistant responses,
advertised MCP tool calls and arguments, model-visible tool results, expected
meanings, and judge reasons. It also keeps hashes for comparison. A failed
meaning assertion runs and records all nine judgments, so disagreement is
visible without a rerun.

Failed answer and judge invocations record a safe cause such as a timeout,
process exit code, missing result event, or fixed provider error category. The
failed answer trial is identified even when earlier trials completed.

Treat test conversations as publishable artifact content. Use synthetic,
non-sensitive fixtures and never put credentials or production data in prompts,
tool arguments, tool results, assertions, or application context.

Provider events, MCP addresses, configuration, headers, provider and harness
credentials, environment values, stderr, and home-directory paths are not
retained. Known configured authentication values are scrubbed from elicitation
evidence. Arbitrary secrets placed inside test content are not detected.
Local evidence is written with mode `0600`; repository CI retains it for 14
days.

## Opt In to Native ChatGPT Browser Journeys

Import `@emseepea/testing/chatgpt` only when you want to test the real ChatGPT
web experience. Ordinary framework tests do not enable this adapter or install
Playwright. This is an experimental browser
adapter: ChatGPT controls can change, and live host qualification is pending.

On your own machine, install the optional browser tooling:

```sh
npm install --save-dev @emseepea/testing playwright@1.62.1
npx playwright install chromium
npx emseepea-chatgpt-setup --enable-native-chatgpt --account-owner '<test-account-owner>'
```

Before publication, run the source checkout with
`node packages/testing/chatgpt/setup.mjs` using the same arguments.

The setup command opens a dedicated headed browser. Sign in to the authorized
ChatGPT test account, complete MFA, check the account, and type `READY` in the
terminal. Codex CLI login does not sign in to ChatGPT.

If bundled Chromium
cannot complete your account login, use `--browser-channel chrome` with an
installed Chrome browser. The profile defaults to `~/.emseepea/chatgpt-browser`;
keep it outside the repository and CI artifacts.

The command verifies a
signed-in control, not the account's identity; the human confirms that identity.
If that control changes, pass an account-specific `--authenticated-selector`.

Connect your authorized HTTPS MCP endpoint through ChatGPT's current plugin
installation flow. Complete account consent yourself. A local server requires
a supported HTTPS tunnel before ChatGPT can reach it. See the
[official ChatGPT connection instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Use synthetic fixtures and a dedicated account; starting a fresh conversation
does not disable account memory. This package does not create an endpoint,
install a plugin, grant consent, or infer client identity from a user agent.

Create an adopter-owned `.mjs` scenario module that exports `authorization` and
`createJourney({ page, runId })`. The authorization declares `approved: true`,
`fixturePolicy: "synthetic"`, an HTTPS `endpoint: new URL(...)`, and the
`accountOwner`, `endpointOwner`, `fixtureOwner`, and `cleanupOwner` strings.


Use the same account owner as setup. `createJourney` returns `checkpoints` and
an asynchronous `cleanup(signal)` callback. The callback must confirm both
`fixturesRemoved: true` and `conversationsRemoved: true` after observing cleanup.

The CLI supplies the explicit enable flag, authorized page, run ID, and ownership.

```sh
npx emseepea-chatgpt --enable-native-chatgpt --scenario ./native-chatgpt.mjs
```

Before publication, use `node packages/testing/chatgpt/run.mjs` after building
the package. The command reuses the private profile and writes evidence to
`artifacts/native-chatgpt/evidence.json`. Exit code 0 means passed, 1 means an
assertion failed, and 2 means blocked or incomplete.

The exported `NativeChatGptJourneyModule` type describes the scenario contract.
For direct integration, use `defineNativeChatGptJourney` and
`runNativeChatGptJourney(journey, outputPath)` with your own authenticated
Playwright page. The runner never launches a browser by itself. Use these
checkpoint operations in the order your application requires:

- `human`: wait for the account owner to finish connection or consent.
- `attach`: upload a synthetic file and observe its ready control.
- `send`: submit a prompt and assert the completed assistant response.
- `server-observation`: assert MCP calls after every submitted turn.
- `visible`, `click`, and `image`: inspect or interact with an application card,
  including locators inside its iframe. Image assertions receive PNG bytes.
- `application-state`: compare a declared SHA-256 with independently read state.
- `fresh-conversation`: start a new conversation, then submit and observe retrieval.

Default controls use ChatGPT's composer and send/stop buttons. Override
`controls` with locators from the authorized page when the UI changes.

`timeoutMs` bounds each browser operation or callback (default 30 seconds),
and `clockSkewMs` allows 0–5000 ms between browser and server clocks (default
1000 ms). A callback must respect its abort signal; timing it out cannot undo
an operation already sent to a server.

A server collector receives `runId`, `afterSequence`, `since`, and `signal`.
Return ordered, run-scoped calls matching the declared method, target, outcome,
and optional result hash. Each call includes request/result SHA-256 values,
endpoint SHA-256, sequence, timestamp, and `nativeClient`.

Set
`nativeClient: "verified-chatgpt"` only when your authenticated server boundary
establishes that the request came through the dedicated ChatGPT connection;
use `"unverified"` otherwise.

A user agent, browser answer, or simulator record
cannot establish this. Define your run correlation and authenticated boundary
before attempting live qualification. An unavailable collector or unverified
client produces incomplete evidence.

Evidence retains bounded hashes and fixed failure categories. It omits raw
prompts, replies, endpoint addresses, ownership strings, cookies, and arbitrary
observer metadata. Explicit `image` checkpoints save scoped PNGs alongside
the evidence; review the selected card for private content before enabling one.

Files use mode `0600`. Store evidence privately and choose your own retention
policy. Cleanup is required even after an assertion fails.

The package's scripted-page and intercepted Chromium tests verify the adapter
contract. They do not prove compatibility with live ChatGPT. Qualify connection,
real MCP invocation, visible card, durable application state, fresh retrieval,
and cleanup against your owned account and endpoint before claiming that host
journey works.
