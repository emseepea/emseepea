---
status: "proposed"
date: 2026-08-28
human-oversight: confirmed
oversight-date: 2026-08-28
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-28
supersedes: ["ADR-0022"]
---

# Subscription-Backed Claude Semantic Release Checks

## Context and Problem Statement

Em See Pea must check that a language model understands every example, not only
that each example returns valid data. The previous release check used GitHub
Copilot CLI. The project owner will not pay for Copilot when an existing Claude
subscription can support the same check in GitHub Actions.

The replacement must preserve the existing Promptfoo trials, live MCP material,
release-revision evidence, and publication block without giving the model access
to MCP, the shell, repository files, or publishing credentials.

## Decision Drivers

- Use the project owner's existing Claude subscription instead of separate
  Copilot or Anthropic API billing.
- Keep three fresh answers and three independent judgments for every example.
- Test material obtained through the official MCP client.
- Bind passing evidence to the GitHub revision being published.
- Give the model no tools and give the evaluation job read-only repository access.
- Keep authentication out of source, logs, examples, and retained evidence.
- Reuse the existing Promptfoo harness instead of adding another automation layer.

## Considered Options

1. **Pinned Claude CLI with subscription OAuth** - Run the pinned
   `@anthropic-ai/claude-code` package through the existing Promptfoo provider,
   using a `CLAUDE_CODE_OAUTH_TOKEN` repository secret generated from the Claude
   subscription.
2. **Claude Code GitHub Action** - Run `anthropics/claude-code-action` directly
   for each check, adding its GitHub App and action layer around the existing
   multi-trial harness.
3. **Local Codex with a GitHub evidence handoff** - Run Codex locally through
   the ChatGPT subscription and build a separate mechanism to attach trusted
   results to GitHub.
4. **Deterministic tests only** - Remove the language-model understanding check
   and rely on protocol and schema tests.

## Decision Outcome

Chosen option: **"Pinned Claude CLI with subscription OAuth"**, because it
preserves the existing purpose-built Promptfoo harness, works in GitHub Actions
with the existing Claude subscription, and needs no GitHub App or model API key.

The root development dependencies pin `@anthropic-ai/claude-code`, and the
provider invokes only its repository-local binary. The requested model is pinned
to `claude-sonnet-4-6`. The verifier requires that exact model in Claude's usage
record while permitting provider-reported internal support calls. It never
silently chooses another main model.

For every trial, the harness starts the example and obtains the required result
through the official MCP client. Claude receives only that material and the
question. Promptfoo runs three fresh answer trials and three independent judge
trials per example, with no semantic retries.

Claude runs in a new temporary directory with safe mode, no inherited settings,
no skills, no saved session, no MCP configuration, and an empty tool list. The
provider rejects tool use, additional conversation turns, an absent or incorrect
main model, malformed output, provider errors, and non-zero process exits.

The GitHub evaluation job has only `contents: read`. It receives
`CLAUDE_CODE_OAUTH_TOKEN` only for the Claude evaluation step. Example servers
never receive that token or an Anthropic API key. The token is never written to
a file, printed, retained as evidence, or made available to publishing steps.

Release evidence records the GitHub revision, pinned package and model,
configuration digest, example results, official-client operation digests, tool
and turn counts, and redacted failures. Evidence is retained for 14 days.

When a release revision has no changeset, publication requires its Claude check
to pass. A missing or expired token, exhausted subscription, provider outage,
model mismatch, timeout, malformed result, or missing evidence stops publication.
Preparing a Changesets release pull request does not call Claude.

## Consequences

### Good

- The release check uses an existing Claude subscription rather than another
  paid model service.
- The tested MCP path, trial count, and meaning checks remain unchanged.
- The model receives no tools or direct access to the example servers.
- The evaluation job needs only read access and no GitHub App installation.

### Neutral

- A long-lived subscription token is stored as a GitHub Actions secret.
- Deterministic tests remain separate and can run without model access.
- Claude may report internal support-model usage in addition to the required
  `claude-sonnet-4-6` call; evidence records this without treating it as a
  fallback main model.

### Bad

- The release path depends on one maintainer's Claude subscription and token.
- Subscription exhaustion, token expiry, or a Claude outage can stop publication.
- Forty-two model outputs per full run consume subscription allowance and add
  release time.
- The token must be rotated when compromised and replaced if ownership changes.

## Confirmation

- `@anthropic-ai/claude-code` and Promptfoo are exact development dependencies
  and are absent from the published server package.
- The provider invokes the repository-local Claude binary with
  `claude-sonnet-4-6`, safe mode, no saved session, no inherited settings, no MCP
  configuration, and no tools.
- Tests reject tool calls, additional turns, a missing or incorrect main model,
  provider errors, malformed results, and non-zero exits.
- Tests prove the OAuth token reaches only the Claude child and never examples,
  logs, errors, evidence, or the published package.
- Every example retains three answer trials, three judge trials, deterministic
  facts, and official-client request and response digests without semantic retries.
- The GitHub job has only `contents: read`, retains redacted evidence for 14
  days, and publication depends on a passing check for the same GitHub revision.
- Copilot permissions, credentials, packages, commands, and provider code are absent.
- A real GitHub run using the subscription token passes before the release risk
  is reduced or publication is described as ready.

## Pros and Cons of the Options

### Pinned Claude CLI with subscription OAuth

- Good: Reuses the existing harness and subscription with the smallest permission surface.
- Bad: Stores a long-lived personal subscription token as a repository secret.

### Claude Code GitHub Action

- Good: Provides an official ready-made GitHub automation wrapper.
- Bad: Its single-task shape and GitHub App permissions do not fit the existing
  fixed multi-trial provider harness.

### Local Codex with a GitHub Evidence Handoff

- Good: Uses the existing ChatGPT subscription without a repository model secret.
- Bad: Requires a new trusted handoff mechanism before GitHub can permit publication.

### Deterministic Tests Only

- Good: Fast, stable, and independent of a model provider.
- Bad: Cannot detect a language model drawing the wrong conclusion from correct data.

## Reassessment Criteria

Reassess when the pinned model or package is retired, subscription OAuth is no
longer supported for GitHub Actions, the token owner changes, rotation becomes
unmanageable, subscription use repeatedly blocks releases, or a safer
short-lived authentication method supports the same multi-trial harness.
