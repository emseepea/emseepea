# Semantic Example Qualification

Promptfoo runs one semantic case for every example. Each case has three fresh
agent trials and three independent judge verdicts, plus deterministic critical
facts and MCP path evidence. For each trial, the harness executes the exact live
operation through the official client and gives the bound result to the agent;
the agent and judge receive no MCP tools.

Run the local Claude advisory gate after authenticating Claude CLI:

```sh
npm run test:eval
```

GitHub Actions runs `npm run test:eval:ci` with the pinned GitHub Copilot CLI and
`claude-sonnet-4.6`. Only that exact-commit run can satisfy the release gate.
Generated redacted evidence is written under `artifacts/llm-eval/`. Advisory
evidence records whether the worktree is dirty and includes a source digest.
Promptfoo retries are disabled; provider-internal transport retries are reported
as unobservable and remain bounded by the provider timeout.
