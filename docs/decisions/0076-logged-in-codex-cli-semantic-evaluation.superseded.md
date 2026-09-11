---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
supersedes: ["ADR-0073"]
---

# Logged-In Codex CLI Semantic Evaluation

## Context and Problem Statement

The first local OpenAI design required maintainers to provide an
`OPENAI_API_KEY` and called the Responses API directly. That contradicts the
intended local experience: maintainers who are already signed in to Codex with
ChatGPT should be able to run OpenAI semantic evaluations without a separate
API credential.

The installed Codex CLI supports non-interactive execution with saved ChatGPT
authentication, structured JSONL events, native MCP servers, resumable
sessions, and structured final output. A revised design must use that supported
local boundary while keeping the model's callable surface limited to the
fixture tools and preserving bounded, inspectable evidence.

## Decision Drivers

- Reuse the maintainer's existing local ChatGPT/Codex sign-in.
- Require no OpenAI API key locally or in CI.
- Keep `claude-ci` as the sole authoritative release provider.
- Exercise OpenAI through provider-native MCP rather than translated function
  tools.
- Prevent any fourth, repeated, malformed, or unadvertised tool call from
  reaching the fixture.
- Exclude user configuration, unrelated tools, credentials, raw events, local
  paths, and temporary session data from retained evidence.
- Preserve genuine conversation history across follow-up messages.
- Pin and verify the local CLI and model contracts that the parser depends on.

## Considered Options

1. **Logged-in Codex CLI with a guarded MCP proxy** - Run `codex exec` with
   saved ChatGPT authentication, expose only an invocation-scoped MCP proxy,
   and validate calls before forwarding them to the fixture.
2. **Direct Responses API with an API key** - Keep the prior implementation
   and require each maintainer to provision and export an API credential.
3. **Keep Claude as the only provider** - Remove the local OpenAI option.

## Decision Outcome

Chosen option: **"Logged-in Codex CLI with a guarded MCP proxy"**, because it
matches the requested credential-free local experience and uses OpenAI's native
MCP client without changing CI or exposing the fixture directly to an
unbounded model tool loop.

`emseepea-test` accepts `--provider openai-local`. The provider requires Codex
CLI `0.145.0` to report an active ChatGPT login and pins model `gpt-5.6-sol`.
Unknown CLI versions, model mismatches, authentication failures, and JSONL
schema drift fail closed with categorical errors.

Each evaluation gets an isolated temporary working directory and an isolated
temporary `CODEX_HOME` containing only a mode-`0600` copy of the maintainer's
existing `auth.json`. The copy is made without reading or logging its contents,
and `OPENAI_API_KEY` is removed from the Codex child environment. User
configuration and project rules are ignored. Shell, unified
execution, web search, browser and computer use, image tools, apps, plugins,
skills, agents, hooks, memories, and every unrelated MCP server are disabled.
The Codex invocation uses a read-only sandbox and never asks for approval.

The only model-visible integration is an invocation-scoped loopback MCP proxy.
It advertises exactly the fixture's public tools. Before forwarding through the
existing official MCP client, the proxy validates the tool name, object
arguments, advertised input schema, canonical duplicate signature, and shared
three-call budget. Rejected calls never reach the fixture. MCP authentication,
addresses, and target-server credentials remain outside the model-visible
prompt and retained evidence.

The harness parses a bounded allowlist of Codex JSONL event shapes and the
session metadata's actual `model` field, and rejects
unknown item types, non-target tool calls, permission requests, missing MCP
results, missing completion, or unexpected turn structure. The first command
captures its exact thread identifier; follow-ups resume only that thread with
the same restrictions and model. On success, failure, timeout, or cancellation,
the harness removes only its isolated temporary `CODEX_HOME` and requires
cleanup to succeed. This deletes the harness-created resumable session and
credential copy without touching unrelated Codex sessions or the original
authentication source.

Meaning judgments use ephemeral `codex exec --output-schema` invocations with
no MCP server and the same pinned model. OpenAI-local evidence is always
non-authoritative and labels turns `native-mcp`. `claude-local` remains the
default and `claude-ci` remains the only CI and release provider.

## Consequences

### Good

- Local OpenAI evaluations work with the maintainer's existing ChatGPT login.
- The model exercises the fixture through native MCP.
- The guarded proxy enforces call safety before fixture effects occur.
- Isolated Codex state makes exact session cleanup possible.
- CI credentials, workflows, and release authority remain unchanged.

### Neutral

- Local OpenAI evaluation consumes the maintainer's Codex allowance.
- The provider supports one pinned Codex CLI and model contract at a time.
- The proxy adds one local hop between Codex and the real fixture.

### Bad

- Codex CLI upgrades can require parser and capability updates before local
  OpenAI evaluations run again.
- A full semantic run creates many Codex turns and can consume meaningful local
  allowance.
- The harness must maintain a narrowly configured MCP proxy and JSONL parser.

## Confirmation

- `codex login status` succeeds against the isolated credential copy with
  ChatGPT authentication and no
  `OPENAI_API_KEY`; a real synthetic fixture evaluation passes with model
  `gpt-5.6-sol` on Codex CLI `0.145.0`.
- A behavioral inventory sentinel proves only the fixture's advertised target
  MCP tools are callable; attempts to use shell, filesystem, web, browser,
  apps, plugins, skills, agents, or unrelated MCP tools cannot execute.
- Behavioral tests prove an unknown, malformed, schema-invalid, canonical
  duplicate, or fourth tool call is rejected before the fixture sees it.
- Follow-up tests prove the exact captured Codex thread is resumed and retains
  prior user messages, MCP calls, results, and answers.
- Success, failure, timeout, and cancellation tests prove only the isolated
  temporary Codex home is removed and cleanup failure fails the evaluation.
- Session metadata records the actual model as `gpt-5.6-sol`; a mismatch fails
  before evidence can pass.
- Evidence omits auth material, raw JSONL, MCP credentials and addresses,
  temporary paths, user configuration, thread identifiers, and provider error
  bodies.
- Output, individual events, prompts, answers, arguments, MCP results, total
  time, call count, and process-tree cancellation are bounded.
- `npm run test:eval:ci`, release workflows, and publication conditions remain
  unchanged and select only `claude-ci`.

## Pros and Cons of the Options

### Logged-in Codex CLI with a guarded MCP proxy

- Good: Reuses supported saved authentication and exercises native MCP.
- Good: Enforces tool-call bounds before fixture effects.
- Bad: Couples the harness to a pinned Codex CLI event and configuration
  contract.

### Direct Responses API with an API key

- Good: Uses a smaller HTTP implementation with direct request control.
- Bad: Requires a separate paid API credential and exercises translated
  function tools rather than native MCP.

### Keep Claude as the only provider

- Good: Adds no local provider or maintenance surface.
- Bad: Does not provide the requested OpenAI comparison.

## Reassessment Criteria

Reassess when the pinned Codex CLI or model is retired, Codex offers an
ephemeral resumable-session API, native tool inventory cannot be restricted to
the proxy, the CLI JSONL contract changes, or OpenAI evidence is proposed as an
authoritative release signal.
