# Current Release Readiness

Date: 2026-09-24

This review covers the source planned for the next package release. It does not
claim that the package has been published or that Voder's live Store-review
checks meet their runtime target. The website is outside this release and
remains unchanged.

## Planned Package Set

- `@emseepea/testing@0.16.6`

This handwritten list is the documented release-unblocking workaround while
problem P008 remains open. It is not independent human confirmation of the
generated release plan.

## Source Evidence and Limits

A behavioural test proves that:

- three independent answer tests and nine evaluations can run at the same time;
- all parallel tasks finish even if one fails; and
- saved evidence keeps its original order.

The complete semantic runner test file passed 4 of 4 tests. The exact source
commit passed every required local repository check, including examples that
run in containers. Independent architecture, cognitive-accessibility, and
Markdown-accessibility reviews passed.

## Required Publication Evidence

- Quality must pass on the exact source commit.
- The generated release pull request must contain only
  `@emseepea/testing@0.16.6`. Its Release checks must pass on the latest commit
  in that pull request.
- Trusted publication must publish that planned version under `next`.
- A registry readback must confirm the published version, package integrity,
  signatures, build origin, exact source commit, and public types. A clean
  installation must exercise the registry package.
- Only that verified tarball may then be promoted to `latest`, tagged, released,
  and merged back.
- Voder must consume the published package and rerun the live Store-review
  checks. Publication alone does not prove the under-one-minute target.

## Review Status, Not Release Status

- Result: PASS
- Risk review: PASS within the accepted risk threshold, provided all required
  checks pass on the exact source commit.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.
