---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
supersedes: ["ADR-0021"]
---

# Harness-Mediated Semantic LLM Qualification for Examples and Releases

## Context and Problem Statement

Protocol tests can prove that an MCP server returns valid data while missing the
more important failure: an LLM may misunderstand what the data means and give a
confidently wrong answer. Every Em See Pea example therefore needs repeatable
semantic qualification through its real MCP path, and publication must be
blocked unless the exact publishing commit passes that qualification.

ADR-0021 required the model to call a custom loopback MCP server directly.
The authoritative GitHub run proved that enterprise provider policy blocks that
server before inference. This decision replaces the unavailable mechanism while
preserving the same release-blocking semantic objective.

## Decision Drivers

- Detect semantic misunderstandings that schema and protocol assertions cannot.
- Exercise every example through the MCP path an adopter is being shown.
- Make release evidence reproducible, fail-closed, and tied to an exact commit.
- Keep deterministic tests fast and independent from model availability.
- Bound provider cost, tool use, retries, permissions, and retained evidence.
- Avoid overstating results beyond the provider, model, examples, and commit tested.

## Considered Options

1. **Harness-mediated MCP material with GitHub Copilot CLI** - For every trial,
   use the official MCP client to execute the exact operation, bind the returned
   material to evidence, then use Promptfoo to run a pinned Copilot model as the
   authoritative interpreter and judge without model tool access. Local Claude
   runs remain advisory.
2. **Autonomous Copilot MCP tool use** - Give Copilot direct access to the named
   loopback MCP server and require it to choose and call the operation.
3. **Deterministic protocol tests only** - Rely on schemas, black-box MCP tests,
   and exact expected values without evaluating model interpretation.
4. **Advisory manual model testing** - Let maintainers try examples with an LLM
   when convenient without making results reproducible or release-blocking.

## Decision Outcome

Chosen option: **"Harness-mediated MCP material with GitHub Copilot CLI"**,
because it tests the user-visible meaning of every example while retaining a
bounded, auditable, exact-commit release gate and working within provider policy.

Promptfoo is mandatory for every current and future example. The authoritative
CI provider and judge are GitHub Copilot CLI pinned to `claude-sonnet-4.6`.
GitHub Models is retired and excluded. Local Claude execution may implement the
same examples for advisory feedback but cannot satisfy the release gate.

For every agent trial, the harness starts the example and uses the official MCP
client to perform the exact named tool call, resource read, or prompt render.
The LLM receives the resulting material and the question with no MCP, shell, or
filesystem tools. Evidence binds the operation input and response with SHA-256
digests. This proves semantic interpretation of live MCP results; it does not
claim autonomous capability selection by the LLM.

Each example receives three fresh, uncached agent trials and three independent
judge verdicts: six graded provider outputs per example. All three trials must
pass the deterministic critical facts, the meaning rubric, and the required path
evidence. A correct-looking answer without the required MCP evidence fails.
Every example records the exact official-client operation and material digest.

The model receives no MCP access. Inference is bounded by a Copilot response-credit
cap, a provider timeout, and a job timeout. The judge also receives no MCP access.

Semantic retries are prohibited. Only bounded, reported transport retries are
allowed. The gate fails closed on missing credentials, unsupported configuration,
provider or model mismatch, missing path evidence, judge failure, timeout, or
artifact failure.

Promptfoo and Copilot CLI are development-only and pinned with their exact
dependency closure in the root lockfile. Copilot CLI is an approved non-shipped
proprietary CI-tool exception; it does not change the repository's MIT licence or
runtime dependency policy.

The evaluation process disables cache, telemetry, update checks, sharing, remote
generation, ambient `.env` loading, persistent configuration, inherited
instructions, plugins, subagents, user interaction, shell access, filesystem
read and write access, arbitrary URLs, and all MCP servers. The harness alone
connects to the named loopback MCP server through the official client. The Copilot
credential is passed only to the Copilot child through an allowlisted environment.

The deterministic `npm test` gate remains separate from `npm run test:eval`.
Only the semantic-evaluation job receives `contents: read` and
`copilot-requests: write`; publishing authority remains in a separate dependent
job. Model-backed evaluation never runs untrusted fork code with credentials.

Redacted evidence is retained for exactly 14 days and identifies the exact commit,
dependency versions, effective provider and model, configuration digest, example
and trial results, operation and material digests, turn and tool counts, rubric verdicts,
transport retries, and errors. Release claims name only that evidence, provider,
model, example set, and commit; they never claim generic LLM understanding.

## Consequences

### Good

- Examples are checked for correct model interpretation, not merely valid JSON.
- Every published commit has reproducible semantic evidence from live MCP operations.
- Every failure exposes whether facts, meaning, or MCP use caused the gap.
- Provider authority and release authority remain separated by least privilege.

### Neutral

- Local deterministic checks stay fast while authoritative semantic checks run in CI.
- The project supports an advisory local provider in addition to the CI provider.
- Resource and prompt examples prove consumption through an official client
  rather than claiming an LLM selected those capabilities autonomously.

### Bad

- Qualification consumes Copilot capacity and adds release latency.
- A provider outage or model removal can block publication even when code is sound.
- Three trials and three judgments reduce but cannot eliminate model variance.
- The harness and redacted evidence contract require ongoing maintenance.

## Confirmation

- Every example has Promptfoo qualification with deterministic critical facts,
  a semantic rubric, and explicit MCP path evidence.
- Every example runs three uncached agent trials and three judge verdicts, and all
  three trials pass without semantic retries.
- Every trial records the exact official-client operation and bound material digest.
- Agents and judges have no MCP access and use the configured response-credit,
  provider, and job bounds.
- CI proves the effective GitHub Copilot CLI provider and
  `claude-sonnet-4.6` model or fails closed.
- The harness alone connects to the named loopback MCP server; model processes have no MCP tools;
  shell, filesystem access, arbitrary URLs, inherited instructions, plugins,
  subagents, and user interaction are unavailable.
- The eval job has only `contents: read` and `copilot-requests: write`; no model
  credential is available to untrusted fork code or the publishing job.
- Promptfoo and Copilot CLI are pinned development dependencies and are absent
  from the published `@emseepea/server` package.
- `npm test` and `npm run test:eval` are distinct commands and gates.
- Redacted JSON evidence contains the required exact-commit and execution fields,
  uses a commit-pinned artifact action, and is retained for exactly 14 days.
- The release job depends on passing semantic evaluation of the exact publishing
  SHA and references that run or artifact in release evidence.
- Public claims remain specific to the tested provider, model, examples, and SHA.

## Pros and Cons of the Options

### Harness-mediated MCP material with GitHub Copilot CLI

- Good: Makes semantic correctness a repeatable and release-blocking property.
- Good: Preserves exact path evidence, bounded execution, and least privilege.
- Bad: Adds model cost, variance, provider dependency, and CI complexity.

### Autonomous Copilot MCP tool use

- Good: Exercises model-led tool selection and invocation.
- Bad: GitHub enterprise policy can block custom loopback MCP servers, making the
  release gate depend on an account policy outside the repository's control.

### Deterministic protocol tests only

- Good: Fast, cheap, stable, and easy to reproduce locally.
- Bad: Cannot detect an LLM drawing the wrong conclusion from correct data.

### Advisory manual model testing

- Good: Requires little automation and allows broad exploratory feedback.
- Bad: Produces inconsistent evidence and cannot protect an exact release commit.

## Reassessment Criteria

Reassess when the pinned provider or model is retired, provider policy prevents
the required isolation or evidence, accumulated results justify changing the
three-trial threshold, costs become disproportionate, or a materially stronger
open and reproducible semantic-evaluation path becomes available.
