# Risk Register

This register records persistent project risks. Scoring and appetite come from
the [risk policy](../../RISK-POLICY.md).

## Register

Scores use the risk policy's 1-25 scale. Higher scores need stronger treatment.
A dash (`—`) means the score is not estimated yet. A residual score above the
5-point appetite blocks the affected publication or release action.

| ID | Risk | Category | Inherent | Residual | Treatment | Owner | Next review |
|---|---|---|---:|---:|---|---|---|
| [R001](R001-published-content-is-not-understandable.active.md) | Published content is not understandable | Brand | 20 | 20 | Mitigate | Documentation maintainer | 2027-02-27 |
| [R002](R002-protected-tools-run-without-valid-authorization.active.md) | Protected tools run without valid authorization | Information security | 15 | 5 | Mitigate | Framework security maintainer | 2027-02-28 |
| [R003](R003-checked-boundaries-fail-or-expose-backend-data.active.md) | Checked boundaries fail or expose backend data | Information security | 15 | 5 | Mitigate | Framework security maintainer | 2027-02-28 |
| [R004](R004-public-claims-exceed-exact-evidence.active.md) | Public claims exceed exact evidence | Brand | 20 | 5 | Mitigate | Documentation and release maintainer | 2027-02-28 |
| [R005](R005-semantic-qualification-misses-wrong-meaning.active.md) | Semantic qualification misses wrong meaning | Delivery | 12 | 8 | Mitigate | Semantic-qualification maintainer | 2027-02-28 |
| [R006](R006-work-outlives-deadlines-or-resource-bounds.active.md) | Work outlives deadlines or resource bounds | Operational | 12 | 4 | Mitigate | Framework runtime maintainer | 2027-02-28 |
| [R007](R007-release-pipeline-publishes-the-wrong-or-compromised-package.active.md) | Release pipeline publishes the wrong or compromised package | Information security | 15 | 5 | Mitigate | Release maintainer | 2027-02-28 |
| [R008](R008-official-ui-is-inaccessible.active.md) | Official UI is inaccessible | Delivery | 16 | 16 | Mitigate | UI package maintainer | 2027-02-28 |
| [R009](R009-ui-presentation-is-mistaken-for-effect-authority.active.md) | UI presentation is mistaken for effect authority | Information security | 15 | 15 | Avoid and mitigate | Framework security maintainer | 2027-02-28 |
| [R010](R010-guides-and-examples-drift-from-released-packages.active.md) | Guides and examples drift from released packages | Delivery | 16 | 12 | Mitigate | Documentation and examples maintainer | 2027-02-28 |
| [R011](R011-untrusted-ui-data-executes-markup-or-reveals-private-state.active.md) | Untrusted UI data executes markup or reveals private state | Information security | 20 | 20 | Avoid | Framework security maintainer | 2027-02-28 |
| [R012](R012-framework-examples-obscure-correct-adoption.active.md) | Framework examples obscure correct adoption | Delivery | 20 | 20 | Mitigate | Framework developer-experience maintainer | 2027-02-28 |
