# Current Release Readiness

Date: 2026-11-03

## Visible Claude message retention

Status: **PREPARED, NOT PUBLISHED**. The repair retains ordered visible native
Claude assistant messages separately from the terminal response. Hidden
reasoning is excluded. Final-response assertions keep their existing meaning.
Earlier messages cannot substitute for a missing final explanation.

The public turn exposes immutable `assistantMessages` arrays by trial. Saved
evidence retains the observed messages and a separate message hash. Meaning-judge
history retains the messages. Repeated messages remain intact; the parser does not infer
intermediate or final phases from matching text. Other providers currently
return empty message arrays.

## Planned package

The existing Changesets planner selects one patch release:

- `@emseepea/testing@0.26.14`

No initializer or framework package release is planned. Generated release
metadata must still match this plan.

## Verified preparation

The testing-package suite passed all 141 tests. A focused Node 24.22.1 run
passed 41 parser, failure-category and judge-history tests. These checks cover
ordered messages, repeated text, hidden-reasoning exclusion, immutable public
output, retained failed evidence and final-response assertion isolation.

Full clean-commit qualification passed for source
`73e9910a3ebeaa55619ad03791643c5f3556ff23`. It ran the existing locked install
and complete test suite. The documentation changes in this readiness update
still require qualification at their own exact commit before push.

Earlier qualification attempts remain failed. Docker was stopped during the
first attempt; the existing Docker service was restored. A later run exposed
a README paragraph above the repository limit and three unrecorded fresh-install
dependency versions. The paragraph was split and the packed-consumer test
passed after dependency-graph reconciliation.

The first dependency failure was reproduced on unchanged main. The original
lock-only resolutions were `@hono/node-server@2.1.6`,
`fast-json-stringify@7.2.1` and `jose@6.2.15`.

A later fresh-consumer check resolved `semver@7.8.6` and
`thread-stream@4.2.1`. The exact root development pin for semver was updated
from 7.8.5 to 7.8.6, with npm-generated lockfile reconciliation for both packages.
The latest full run failed. The repaired exact commit still requires qualification.

These changes reconcile the observed dependency graph; they are not selected
vulnerability repairs. No security gate or acceptance assertion was
weakened.

## Reviews and remaining checks

Architecture and jobs-to-be-done reviews passed. The new tests were classified
as behavioral. Changeset risk, voice and independent cognitive-accessibility
reviews passed. The cumulative source risk assessment rated commit, push and
release at 5/25, within appetite and subject to the existing exact-commit gates.

Publication remains pending. Required checks include the final source Quality
run, exact release-candidate semantic qualification, downloaded-package and
registry verification, standard governed promotion, and merge-back Quality.
An independent installed-package check must confirm message retention before
issue 227 can close.

This deterministic repair does not recover missing historical qualification
text or relabel a failed result. It does not establish fresh MYOB qualification,
native ChatGPT compatibility or customer-production behavior. Any adopter
rerun must use the released package and retain its own evidence.

The [previous published release record](https://github.com/emseepea/emseepea/blob/9127093869a2d80b98f6d7bbc7d8922609d19b33/docs/reviews/current-release-readiness.md)
remains available with its original publication and adopter evidence.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
