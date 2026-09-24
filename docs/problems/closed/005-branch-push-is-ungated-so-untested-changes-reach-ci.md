# Problem 005: Branch Push Is Ungated, So Untested Changes Reach Continuous Integration (CI)

**Status**: Closed (closed-on-evidence 2026-09-24 — the installed pre-push hook accepted exact commit `0c28ae0cf68c345c3ca64f6cdafba497c06b0116`, and GitHub Quality run `35964172151` passed for that SHA. Recovery: rerun `/wr-itil:transition-problem 005 known-error` to reopen)
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
- **Frequency**: one documented unqualified branch push before the control was
  implemented; no repeat is claimed after the governed push exercise.
- **Severity**: no adopter-facing effect. See the rating note above.
- **Analytics**: the installed hook accepted exact commit `0c28ae0`, and GitHub
  Quality run `35964172151` passed for that SHA.

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

- [x] Create reproduction test
- [x] Obtain architecture and JTBD reviews. Both require repository-wide,
      exact-commit evidence at the native push boundary.
- [x] Draft the complete treatment decision: every non-deletion branch push;
      `npm ci` followed by `npm test`; unchanged clean checkout; pass marker
      bound to each exact outgoing tip.
- [x] Obtain human ratification of the clean-install exact-commit gate in
      ADR-0106 before writing dependent hook, qualification, or installer code.
- [x] After ratification, create behavioural tests that fail before
      implementation and cover absent and stale markers, multiple pushed tips,
      and deletion-only ref updates.

### Review Findings (2026-09-24)

The architecture review confirmed that a plain wrapper command cannot treat the
root cause because `git push` would remain ungated. A repository-owned native
`pre-push` boundary is required. Adding Husky or a path classifier would add
complexity without improving the required repository-wide, exact-commit check.

The JTBD review rejected a test-only marker because stale installed dependencies
contributed to the failure. The proposed gate must first establish the
committed lockfile state with `npm ci`. It must then run the existing
whole-repository `npm test`, confirm that the clean committed checkout is
unchanged, and bind the pass marker to the exact pushed Git commit identifier
(SHA).

This is a durable development-workflow decision. Tom ratified ADR-0106 on
2026-09-24. Behavioural tests now exercise the tracked native hook and
exact-commit qualification. The installed hook accepted governed push commit
`0c28ae0cf68c345c3ca64f6cdafba497c06b0116`, and GitHub Quality run
[`35964172151`](https://github.com/emseepea/emseepea/actions/runs/35964172151)
passed for that exact commit. The root cause is treated. R015 remains Active at
6 because each clone or worktree still needs hook installation and Git permits
an intentional `--no-verify` bypass.

## Fix Released

Implemented on 2026-09-24 in commit
`0c28ae0cf68c345c3ca64f6cdafba497c06b0116`, which is on `main`.
<!-- no-changeset-reference: development-workflow-only fix; no package release intended -->

The repository now provides `npm run push:qualify` and a tracked native
`pre-push` hook. Qualification runs `npm ci` and the existing `npm test` from a
clean committed checkout, then records evidence only for the unchanged exact
commit. The hook checks every non-deletion outgoing tip.

Verification evidence: the installed hook accepted the governed push of that
exact commit, and GitHub Quality run
[`35964172151`](https://github.com/emseepea/emseepea/actions/runs/35964172151)
completed successfully for the same SHA.

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

- [Risk R015: Untested Branch Pushes Consume Continuous Integration (CI) and Weaken Verification Claims](../../risks/R015-untested-branch-pushes-consume-ci-and-weaken-verification-claims.active.md) records the treated push-boundary risk and residual score of 6 (Medium), outside appetite.
- [ADR-0106: Clean-Install Exact-Commit Branch Push Gate](../../decisions/0106-clean-install-exact-commit-branch-push-gate.proposed.md) is the ratified treatment decision.

## Story Maps

Related story maps are listed by ID, title, and lifecycle status.

| ID | Title | Status |
|----|-------|--------|
| STORY-MAP-001 | STORY-MAP-001: Share a verified framework change safely | completed |


## Stories

Related stories are listed by ID, title, and lifecycle status.

| ID | Title | Status |
|----|-------|--------|
| STORY-001 | STORY-001: Qualify Each Outgoing Branch Tip Before Push | done |
