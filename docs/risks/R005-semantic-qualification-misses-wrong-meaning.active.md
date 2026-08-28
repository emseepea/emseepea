# Risk R005: Language-Model Understanding Check Misses Wrong Meaning

**Status**: Active
**Category**: delivery
**Identified**: 2026-08-27
**Owner**: Language-model-check maintainer
**Last reviewed**: 2026-08-28
**Next review**: 2027-02-28

## Description

An example may return technically correct data while a language model draws the
wrong conclusion from it. The understanding test may also pass without using
the live Model Context Protocol (MCP) result.

This can teach adopters to publish tools whose data is correct but misleading
in normal language-model use.

## Inherent Risk

Impact × Likelihood *before* controls.

- **Impact**: 4 (Significant)
- **Likelihood**: 3 (Possible)
- **Inherent Score**: 12
- **Inherent Band**: High

## Controls

- **Live MCP material** - The harness performs the exact operation through the
  official MCP client and binds the returned material to each trial. Implemented
  in `tests/llm/run-eval.mjs`.
- **Independent interpretation checks** - Every example requires three fresh
  agent trials, three independent judge verdicts, deterministic critical facts,
  and exact MCP path evidence. Defined in `QUALITY.md` and
  `tests/llm/promptfooconfig.yaml`.
- **Stop on uncertainty** - An unknown provider, model, credential, path,
  timeout, verdict, or evidence result stops the evaluation. Tested in
  `tests/llm/provider.test.mjs` and `tests/llm/release-workflow.test.mjs`.
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
  or evaluation-harness change.
- **Metrics**: Checked examples versus total examples; passing trials and
  judge verdicts; missing or mismatched MCP evidence; provider and model
  failures; publishing commits without the required evidence.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: none recorded
- Treatment ADRs:
  [ADR-0024: Subscription-Backed Claude Language-Model Understanding Checks](../decisions/0024-subscription-backed-claude-semantic-release-checks.proposed.md)
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
