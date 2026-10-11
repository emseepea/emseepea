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
