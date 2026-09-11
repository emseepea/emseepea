---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
supersedes: ["ADR-0057"]
---

# Local OpenAI Function-Tool Semantic Evaluation

## Context and Problem Statement

Em See Pea's semantic evaluator supports Claude locally and uses Claude for the
authoritative release check. The project has no OpenAI API credential suitable
for CI, but local maintainers should be able to evaluate the same test cases
with an OpenAI model when they supply their own `OPENAI_API_KEY`.

OpenAI's hosted MCP tool requires a remotely reachable server, while semantic
fixtures intentionally listen only on loopback. A local OpenAI path therefore
cannot make the same provider-native MCP claim as the Claude path without
publishing a temporary server or introducing a tunnel.

## Decision Drivers

- Support optional local OpenAI evaluation without adding a CI credential.
- Keep fixture servers loopback-only and effect-safe.
- Preserve unchanged user prompts, native model tool selection, real MCP calls,
  follow-up history, call limits, cancellation, and inspectable evidence.
- Keep the authoritative release path and its evidence meaning unchanged.
- Avoid a new SDK dependency when Node.js provides the required HTTPS client.
- Prevent credentials, request headers, provider events, and local paths from
  reaching fixture servers or retained evidence.

## Considered Options

1. **Supplemental local OpenAI function-tool evaluation** - Expose the target
   server's advertised public tools as OpenAI function tools, execute accepted
   calls through the existing official loopback MCP client, and label the
   result as non-authoritative function-tool evidence.
2. **Temporary public MCP endpoint for OpenAI** - Publish each local fixture
   through a short-lived tunnel so the Responses API can connect to it as a
   hosted MCP tool.
3. **Keep Claude as the only model provider** - Make no change and leave local
   semantic evaluation unable to compare OpenAI behaviour.

## Decision Outcome

Chosen option: **"Supplemental local OpenAI function-tool evaluation"**,
because it adds the requested local comparison without exposing fixtures,
changing CI, or misrepresenting function-tool evidence as a native MCP journey.

`emseepea-test` accepts `--provider openai-local`. That provider requires a
non-empty `OPENAI_API_KEY`, uses Node.js `fetch` with `store: false`, and pins
the OpenAI model to `gpt-5.4-mini-2026-03-17`. The requested and returned model
identifiers are recorded and an unexpected returned model fails closed.

For a conversation turn, the harness sends the user's message unchanged and
offers only function tools derived from the target loopback server's advertised
public names, descriptions, and input schemas. It rejects unknown tools,
invalid arguments, repeated calls, and more than three calls. Accepted calls
are executed through the existing official MCP client, and their outputs are
returned to the same OpenAI conversation until it produces one final answer.
Follow-up messages retain the actual prior prompts, calls, results, and answers.

OpenAI meaning judgments use the same pinned model with no tools and strict JSON
output. Requests, responses, tool loops, and model output remain subject to the
existing cancellation, timeout, size, trial-count, and no-retry bounds.

OpenAI evidence is always `authoritative: false` and uses
`interactionMode: "provider-native-function-tools"`. It cannot approve a
release or be described as provider-native MCP evidence. `claude-local` remains
the default local provider, and `claude-ci` remains the sole authoritative CI
and release provider. No workflow or release-gate change is made.

## Consequences

### Good

- Maintainers can compare OpenAI tool choice and result understanding locally.
- Fixtures stay private on loopback and OpenAI receives no server credential or
  MCP address.
- CI, publication authority, and Claude evidence semantics remain unchanged.
- The implementation adds no package dependency.

### Neutral

- OpenAI sees public MCP tool contracts represented as function definitions.
- Local maintainers pay for and manage their own OpenAI API use.
- Claude and OpenAI evidence prove different native tool protocols.

### Bad

- OpenAI results do not prove OpenAI's hosted MCP client can use the server.
- The testing package must maintain a second provider event and conversation
  shape.
- A full local run performs many paid model and judge calls.

## Confirmation

- `npm test -w @emseepea/testing` passes focused provider, runner, cancellation,
  call-bound, follow-up-history, and redaction tests.
- `emseepea-test eval --provider openai-local` fails clearly without
  `OPENAI_API_KEY` and can pass a real local synthetic fixture with the key.
- Evidence records the exact pinned OpenAI model, remains non-authoritative, and
  labels turns `provider-native-function-tools`, never `native-mcp`.
- Tests prove the OpenAI key, authorization header, raw API events and errors,
  process environment, MCP address, and filesystem paths never reach fixture
  server processes or retained evidence.
- Tests reject unknown, repeated, malformed, or more-than-three tool calls and
  prove cancellation, bounded execution, and genuine follow-up history.
- `npm run test:eval:ci`, the release workflow, and publication conditions still
  select only `claude-ci`.
- Public documentation states what each provider's evidence does and does not
  prove and gives the local OpenAI command without requesting key disclosure.

## Pros and Cons of the Options

### Supplemental Local OpenAI Function-Tool Evaluation

- Good: Keeps fixtures private and reuses the current official MCP execution
  path with no dependency or CI change.
- Bad: Provides OpenAI-native function calling rather than OpenAI-hosted MCP.

### Temporary Public MCP Endpoint for OpenAI

- Good: Exercises OpenAI's hosted MCP integration directly.
- Bad: Expands the security and operational surface for synthetic fixtures and
  requires tunnel lifecycle and access controls for every run.

### Keep Claude as the Only Model Provider

- Good: Adds no code, cost, or provider maintenance.
- Bad: Prevents the requested local OpenAI comparison.

## Reassessment Criteria

Reassess if OpenAI supports a native MCP client that can securely reach a local
loopback server, the pinned model is retired, the function-tool translation
diverges from public MCP contracts, credential or evidence isolation fails, or
OpenAI evidence is needed as authoritative release evidence.
