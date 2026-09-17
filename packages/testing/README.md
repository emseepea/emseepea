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

Use `assertToolNames` when one tool has intentionally free-form arguments. Pair
it with `assertToolArguments` for the stable call and `assertFeedback` for the
feedback observation and important detail. Keep `assertToolCalls` when every
complete argument should match exactly and no feedback tool is advertised.

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

Optional `context` is application context, not test guidance. Use it only when
the deployed application supplies the same context. Leaving it out is the best
default for testing whether tool names, descriptions, and schemas stand on
their own.

Point semantic tests only at isolated, effect-safe test servers and fixtures,
never production. Resources and prompts need deterministic protocol tests;
this library does not pretend that manually injecting their content proves a
native user journey.

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
Custom normalization, legacy migration, stricter comparison rules, baseline
retention, approvals, and deployment policy stay in application code using the
lower-level API above.

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
retained. Secrets placed inside test content are not detected or redacted.
Local evidence is written with mode `0600`; repository CI retains it for 14
days.
