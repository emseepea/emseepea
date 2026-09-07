# Risk R005: Language-Model Understanding Check Misses Wrong Meaning

**Status**: Active
**Category**: delivery
**Identified**: 2026-08-27
**Owner**: Language-model-check maintainer
**Last reviewed**: 2026-09-07
**Next review**: 2027-02-28

## Description

An example may return technically correct data while a language model draws the
wrong conclusion from it. A semantic test may also pass without using the live
Model Context Protocol (MCP) result, or because the harness taught the model how
to choose and format a tool call. That false qualification can hide unclear
tool descriptions and incorrect autonomous tool selection.

This can teach adopters to publish tools whose data is correct but misleading
in normal language-model use.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 12
- **Inherent Band**: High

## Controls

- **Provider-native MCP selection** - Tool-selection cases pass the user message
  unchanged to a provider connected to exactly one loopback MCP server. Tool
  assertions come from native tool-use events, not a coached plan. Implemented
  in `packages/testing/semantic/provider.mjs` and regression-tested in
  `packages/testing/test/runner.test.mjs`. Exact-commit live qualification is
  still required under ADR-0055.
- **No prepared semantic context** - The public semantic API has no path that
  injects harness-collected MCP material. Resources and prompts retain
  deterministic protocol coverage until a representative native client journey
  exists. Defined by ADR-0055.
- **Independent interpretation checks** - Every example requires three fresh
  answers, three independent judgments per answer, required facts,
  and exact MCP path evidence. Defined in `QUALITY.md` and
  `examples/*/eval/*.test.mjs`. The shared runner enforces the trial counts.
- **Stop on uncertainty** - An unknown provider, model, credential, path,
  timeout, verdict, or evidence result stops the evaluation. Tested in
  `packages/testing/test/provider.test.mjs`,
  `packages/testing/test/runner.test.mjs`, and `tests/llm/release-workflow.test.mjs`.
- **Separate publication authority** - The model job has no publishing
  permission. Publication depends on its result for the commit being published.
  Implemented in
  `.github/workflows/release.yml`.

## Residual Risk

Impact × Likelihood *after* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 2 (Unlikely)
- **Residual Score**: 8
- **Residual Band**: Medium
- **Acceptable for publication?**: No

## Treatment

Mitigate. Publication remains blocked until the language-model understanding
check passes for every example on the publishing commit. Passing protocol tests
or a local model run does not make this risk acceptable for publication.

## Monitoring

- **Trigger to re-assess**: Any example, understanding case, model, judge, provider,
  provider-native MCP interface, or evaluation-harness change.
- **Metrics**: Checked examples versus total examples; passing trials and
  judge verdicts; missing or mismatched MCP evidence; provider and model
  failures; publishing commits without the required evidence.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0029: Code-First Semantic Tests](../decisions/0029-code-first-semantic-tests.proposed.md),
  [ADR-0055: Native Client Journeys Only in Semantic Tests](../decisions/0055-native-client-journeys-only-in-semantic-tests.proposed.md)
- Personas affected: adopters and end users of adopter-built servers

## Source Evidence (auto-scaffolded 2026-08-27)

Aggregated from 6 `.risk-reports/` entries:

- `.risk-reports/2026-08-27T05-05-38-commit.md`
- `.risk-reports/2026-08-27T05-28-33-commit.md`
- `.risk-reports/2026-08-27T06-21-25-commit.md`
- `.risk-reports/2026-08-27T06-22-57-commit.md`
- `.risk-reports/2026-08-27T11-59-09-commit.md`
- `.risk-reports/2026-08-27T12-20-22-commit.md`

These source entries seeded the curated risk. Re-rate when controls, source
evidence, or risk policy change.

## Change Log

- 2026-08-27: Auto-scaffolded from recurring pipeline findings.
- 2026-08-28: Replaced Copilot with subscription-backed Claude. Residual risk
  remains unacceptable for publication until the GitHub check passes for a publishing commit.
- 2026-09-07: Recorded false qualification caused by coached tool-selection
  prompts and the pending provider-native MCP treatment. Residual risk remains
  unacceptable until the treatment passes exact-commit live qualification.
