# Cognitive Accessibility Review, 11 October 2026

## Scope

This review covers the two proposed decisions that repair missing exact-commit
Quality evidence after automated release mergeback, the immutable historical
decisions they supersede, related link-only updates, and the generated decision
compendium.

## Result

PASS. The prose clearly separates publication, mergeback, exact-commit Quality
evidence, failure handling, and later human ratification. It uses concrete
terms for each commit and workflow, states what dispatch alone does not prove,
and keeps the evidence boundary consistent in the compendium. The compendium
clearly labels the unchanged confirmed historical records as superseded and
links each one to its current successor.

## Reviewed Content

| File | SHA-256 | Result |
| --- | --- | --- |
| `docs/decisions/0098-publish-on-merge-to-a-publish-branch.superseded.md` | `ec26a554989edea0de749eb4808eb12f75f80a57f56c728bfbfb6ba80011d2ce` | PASS |
| `docs/decisions/0100-trunk-push-and-watch-under-a-publish-branch.superseded.md` | `d3e6489643127da5c96522d49e620994b09a3887ca9072ef4d6d6f6a6fdd7b8f` | PASS |
| `docs/decisions/0111-checked-replacement-candidates-for-unpromoted-failed-releases.proposed.md` | `622eb662ba00c18f113978706ac09a7f1d6503a1dda2edc0dbb5caaa01c874ad` | PASS |
| `docs/decisions/0114-checked-fresh-versions-for-abandoned-staged-candidates.proposed.md` | `806b0bc487319a5729039bcaeda5c3ad287b17cb81a53b073b78fc1a31fe6419` | PASS |
| `docs/decisions/0120-publish-branch-release-with-exact-head-mergeback-quality.proposed.md` | `8aed3c2f236aba267f9c3dba301bfc37fd35059d38abcc93e92d94871b864521` | PASS |
| `docs/decisions/0121-exact-head-qualification-for-automated-trunk-mergeback.proposed.md` | `747895dd6f65bba85749afeeebb000fd286e9f95894a1416dd8746fbfdc0b285` | PASS |
| `docs/decisions/README.md` | `54cec789fec0a392ff31f57a38f853ac352e2667a0a226eb732d513f87caf02c` | PASS |
| `docs/risks/R013-release-reaches-publication-before-registry-prerequisites-are-verified.active.md` | `c4afae69f1596382a772cf8e77c16f8bb23693b3545e4722702cbe4aa49edccd` | PASS |

## Additional Scope: Issue #158 ADR-Only Replay

This additional review covers ADR-0118, ADR-0119, and the regenerated decision
compendium for the issue #158 semantic qualification repair.

PASS. ADR-0118 separates outcome-constrained tool selection from observed
calls. It states that closed-world maximum counts are checked after completion
and do not stop dispatch, truncate evidence, or replace ADR-0116. It also keeps
argument, result, persisted-effect, and response-meaning assertions separate
from the selection outcome.

ADR-0119 clearly labels `toolOutcomes` as an observation, not a verdict. It
separates `isError` from recovery or effect proof. The harness adds no private
provider or transport fields to the documented view, while the exact
model-visible result may contain application data and therefore remains
subject to ADR-0057's non-sensitive synthetic-fixture requirement.

| File | SHA-256 | Result |
| --- | --- | --- |
| `docs/decisions/0118-declarative-outcome-constrained-semantic-tool-selection-assertions.proposed.md` | `a02e4555e3fe7f36fa5892a45a15f1c28777d234c4e5d1196f8b0d8370fb6d98` | PASS |
| `docs/decisions/0119-read-only-native-tool-outcomes-on-semantic-conversation-turns.proposed.md` | `68002159c51e0fcf9c662a17a99f9e518b8c1afffd0c92c57e81f58351c043eb` | PASS |
| `docs/decisions/README.md` | `c5118f3c750bb8a8c1c293af55eb061f910fd987fba41fd02bf91c106b5fcd5f` | PASS |
