# Problem 005: Branch Push Is Ungated, So Untested Changes Reach Continuous Integration (CI)

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 15 (High) — Impact: 3 × Likelihood: 5 — see the rating note below
**Effort**: S (small) — one hook that blocks an operation until a marker exists
**JTBD**: JTBD-101 — a job to be done: publish installable packages safely
**Persona**: framework-maintainer

## Description

A branch was pushed and a pull request opened without running the full test
suite. CI then reported twelve failures: both Node quality jobs, and all ten
standalone initializer jobs. Every one of them was reproducible locally
beforehand.

These suites were run before pushing:

- the black-box suite
- lint
- a typecheck scoped to a single package

This one was not: `npm test`. It adds:

- the decisions check, which verifies the decision records and their index
- the build
- a typecheck across the whole repository
- the example tests
- the `tests/docs` suite
- the `tests/llm` suite

None of the twelve failures was caused by the change. Every one carried the same
assertion: a fresh install resolved a dependency version that the committed
lockfile does not contain. Every one named the same dependency. Two surfaced
locally as `tests/docs` cases. The other ten were the per-initializer jobs, which
each perform the same fresh install.

The cause was committed-lockfile drift. The dependency published a new patch
version, so a fresh install resolved a version outside the lockfile. The same
dependency had been refreshed on the trunk two days earlier for the same reason.
Commit `1eb19d9a` refreshes it again on this branch, and the full test suite
passed afterwards.

### Why the gap was easy to fall into

The worktree's installed packages were a week out of date, because nobody re-ran
the install after a rebase that moved the branch 169 commits forward.

An earlier local run reported two kinds of failure. It reported four typecheck
errors. It also reported two packed-package failures. The author judged both
kinds to be a pre-existing condition of the environment, and did not investigate
either.

Running `npm ci` separated them. The typecheck errors disappeared, so they were
caused by the out-of-date install. The packed-package failures remained.

The author then drew a second wrong conclusion: that because the failures
survived a clean install, the change must have caused them. It had not. Reading
the assertion message would have shown lockfile drift straight away, and named
the dependency. Both conclusions, first "the environment" and then "my change",
were reached without reading the failure output.

An out-of-date install made a real failure look like a pre-existing condition of
the environment. Not reading the failure output kept it misattributed afterwards.

## Rating note

Likelihood is 5 because all three Likelihood 5 conditions in `RISK-POLICY.md`
apply at once: a known gap, an absent control, and a failure mode that has
already been observed.

Impact is 3 because no adopter-facing path was affected. CI blocked the merge,
so nothing shipped. The cost is a CI cycle, plus a pull request whose
verification claim named only the suites that were run and did not say which
were skipped.

## Symptoms

CI reports failures that a full local run would have caught first. The pull
request carries a verification claim that names only the suites that were
actually run. It reads as complete, because it does not say what was skipped.

## Workaround

Run `npm test` before every push. Re-run `npm ci` after any rebase that moves the
lockfile.

## Impact Assessment

- **Who is affected**: maintainers and reviewers, who spend a CI cycle
  discovering what a local run would have shown immediately.
- **Frequency**: (deferred to investigation)
- **Severity**: no adopter-facing effect. See the rating note above.
- **Analytics**: (deferred to investigation)

## Root Cause Analysis

This repository already blocks risky operations until a marker file exists for
them. Three gates use that pattern today: architecture review, external
communications review, and commit risk scoring. Push has no equivalent gate.

One push command does exist, `npm run push:watch`. It pushes, then watches the
pipeline. It fails closed, meaning that if it cannot confirm the pipeline
passed, it reports failure rather than success. But it pushes to `main`, so it
does not cover a feature branch. No git hooks are installed either: `.git/hooks`
holds only the samples git ships, and there is no husky configuration. A plain
`git push` of a branch is therefore entirely ungated.

Any such gate must bind to the exact commit being pushed, rather than to the
session that ran the tests. A marker bound to the session would have authorised
this push: the tests that passed had run against a different tree than the one
pushed, because the rebase moved the branch 169 commits forward in between.

### Investigation Tasks

- [ ] Create reproduction test
- [ ] Decide the gate's scope: every push, or only pushes touching `packages/`
      and `tests/`. The full suite takes over ten minutes, and the packed
      initializer test alone takes about six minutes.
- [ ] Decide whether a check for an out-of-date install belongs in the same
      gate, since that is what disguised the real failure
- [ ] Decide whether the gate should run the suite the way CI does. One guard
      read only the working tree locally while CI read the whole branch, so a
      full local run reported green while CI was red on the same assertion.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

Sibling of P002, the release-readiness verifier ticket. Both sit in the same
release-confidence area, and they name different gaps. P002 is about a verifier
that reports a pass without checking the thing it claims to verify. This ticket
is about no gate existing at the push boundary at all.

Captured via /wr-itil:capture-problem; expand at next investigation.
