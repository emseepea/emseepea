# Problem 002: Release Readiness Verifier Only Tests Fixture-Like Stable PASS Marker

**Status**: Verification Pending
**Reported**: 2026-09-11
**Priority**: 16 (High) — Impact: 4 × Likelihood: 4 — derived at capture from the observed release-blocking failure and narrow contract coverage
**Origin**: internal
**Effort**: S — focused script and fixture coverage should cover the release-marker contract
**Jobs To Be Done (JTBD)**: JTBD-101
**Persona**: framework-maintainer

## Description

The release-readiness verifier depends on the exact marker `- Result: PASS`,
but its regression coverage did not protect the live readiness record contract.
During the 2026-09-11 release, a wording-only accessibility edit changed the
stable marker in `docs/reviews/current-release-readiness.md` to
`- Review result: PASS`. Release run `34550575202` then failed at "Prepare
package evidence". The marker was restored and documented in
`docs/briefing/releases-and-ci.md`, and the later exact-commit release completed
at `9bf599a` in workflow run `34552756999`.

At capture on 2026-09-11 the permanent control was missing: tests should fail
when the live readiness file drifts from the marker contract, not only when a
fixture-shaped record changes. That gap is now closed — see Fix Released.

## Symptoms

- A wording-only edit to the live readiness record passed every local check and
  failed the release instead.
- The failure appeared late — inside the release workflow, after the local test
  suite and the earlier release steps had already passed.
- The error named a regular expression rather than the edit that broke it.
  (Fixed: the two label assertions now name the file and the exact label line
  they expect.)

## Workaround

Do not reword the two marker lines in
`docs/reviews/current-release-readiness.md`. Reword the surrounding prose
instead, and keep `- Result: PASS` and the `- Final result:` line exactly as the
verifier spells them.

## Impact Assessment

- **Who is affected**: maintainers preparing a release.
- **Frequency**: possible on any edit to the readiness record. The record is
  rewritten every release, and it sits in a directory whose review gate exists
  to reword unclear prose, so the two controls meet on every release.
- **Severity**: the release stops. No package or registry state changes, so the
  cost is delay and rework rather than a bad publication.
- **Analytics**: one release-blocking failure on 2026-09-11 (run
  `34550575202`); one release blocked again on 2026-09-19 by the same file, for
  the neighbouring package-set reason recorded below.

## Root Cause Analysis

Two independent causes produce one symptom. Confirmed by reading the code, not
inferred.

**First cause: the contract has no test against the live file.** Every
assertion in `tests/docs/release-readiness.test.mjs` ran against inline fixture
strings written inside the test. Nothing read
`docs/reviews/current-release-readiness.md`. The live record reached the parser
for the first time during the release itself, in
`scripts/push-and-watch.mjs`, `scripts/release-and-watch.mjs`, and
`.github/workflows/release.yml`. A local `npm test` could not see the drift.

**Second cause: the literals the parser needs live inside prose that another
control exists to rewrite.** `isPublicMarkdown` in
`tests/docs/published-content-review.test.mjs` treats every path under `docs/`
as published content, so the readiness record is inside the mandatory
cognitive-accessibility review scope set by ADR-0023. That reviewer's job is to
make wording clearer. The verifier's job is to require exact spellings in the
same file: the `- Result:` line, the `- Final result:` line, and one
backtick-quoted `package@version` line for every package being published. The
2026-09-11 incident was those two jobs meeting.

**Related observation, same file, different concern.** The package set in the
record is transcribed by hand and then checked for exact set equality against
the Changesets plan. On 2026-09-19 that check blocked the release because the
record still named the previous release's twelve packages while sixteen were
being published. This is the same
family — a machine-read value kept in prose — but its fix is a different
change, so it is out of scope here. It is **not** captured as its own ticket
yet. Problem 004 records the observation in the meantime, so it does not leave
the backlog when this ticket closes.

Worth naming for whoever picks up that follow-up: the stop was right about the
record and wrong about the release. The record was stale, so the gate did its
job. But nothing was wrong with the sixteen packages, and a gate that halts a
release over a stale transcription is easier to wave through the next time it
fires — including the time it is right. That last point is a judgement about
risk, not something the 2026-09-19 run proved.

### Investigation Tasks

- [x] Add the smallest regression check that exercises the live
  release-readiness marker contract.
- [x] Keep the public review wording clear without changing the verifier's
  stable machine-readable marker.

## Fix Strategy

**Shape**: internal script and test.

Separate the two things the record's marker lines assert, because they are true
at different times.

- The **labels** — a line starting `- Result: ` and a line starting
  `- Final result: ` — must always be present, because the verifier greps for
  them. A new exported `assertReadinessMarkerLabels` checks only this, and the
  test suite runs it against the live
  `docs/reviews/current-release-readiness.md` on every `npm test`.
- The **verdicts** after those labels — `PASS`, and `within appetite`
  (optionally followed by `, subject to the required exact-commit gates`) — are
  only required when something is actually being published.
  `assertReadinessMarkers` still checks them, and is still reached only through
  `assertReleaseReadiness`, which returns early when no package is pending.

This split is what makes the check assertable at all. The package-set half of
`assertReleaseReadiness` returns early on an ordinary working tree, so running
the whole function against the live file would assert nothing most of the time.

This distinction matters, and the first draft got it wrong. Architecture
review — the `wr-architect` review agent, run in this session — caught it. That
draft asserted `- Result: PASS` against the live record on every test run. It
would have made a permanent claim — that this repository must always be in a
passing state — out of a check that should only bind at publication. A
maintainer honestly recording a failed review would have turned the suite red,
and the only way back to green would have been to change the record to say it
passed. A control whose failure mode is "edit the evidence" is pointed the
wrong way. The label check catches the 2026-09-11 defect exactly as well,
because that defect renamed a label and left the verdict alone.

The new test also reproduces the 2026-09-11 edit and requires it to fail, so
the check is proven to catch the defect it was written for rather than merely
passing today.

**Scope limit, stated plainly.** This closes the detection gap, not the design
that caused it. The markers still live in prose that a rewording gate targets;
Problem 004 tracks the same coupling on another surface, and neither ticket
fixes it. The package set is still transcribed by hand. Problem 004 now records
that follow-up, so it outlives this ticket, but it still needs a ticket of its
own.

Be precise about what the narrowing freed, because it is less than it first
looks. The **detector** is `assertReadinessMarkerLabels`. Every `npm test` runs
it against the live record, and it now checks only the two label prefixes, so it
no longer constrains ordinary rewording. The **release gate** is unchanged. It
is `assertReadinessMarkers` plus the package-set check, and it runs only when a
package is pending. It still freezes the verdict after each label — `PASS`, and
`within appetite` with the exact-commit clause optional — and every
backtick-quoted `package@version` line. So a reword that lands on a verdict
rather than a label still passes locally and still stops the release: `PASSED`
in place of `PASS`, or `within our appetite.` in place of `within appetite.`
The 2026-09-11 failure shape is narrowed, not closed.

## Fix Released

**What changed:** every `npm test` now asserts that the live
`docs/reviews/current-release-readiness.md` still has a `- Result: ` line and a
`- Final result: ` line. The verdicts after those labels are still checked only
when a package is actually being published.

Delivered by the commit that moves this ticket into `docs/problems/verifying/`.
That commit changes `scripts/verify-release-readiness.mjs` and
`tests/docs/release-readiness.test.mjs`; `git log --follow` on this file finds
it. The change is repository tooling, so there is no package release and no
changeset: it takes effect on the next release run, not on a registry.

Root cause, workaround and fix all landed in one session. The ticket therefore
never sat in the Known Error status (the stage where a diagnosed problem waits
for a fix) long enough to get its own commit. The `## Root Cause Analysis`
section above is that Known Error record.

Evidence gathered while writing the fix, all observed in this session:

- The new test was watched failing first. The live record was reworded to
  `- Review result: PASS`, exactly reproducing the 2026-09-11 edit, and
  `node --test tests/docs/release-readiness.test.mjs` reported 1 failed and 7
  passed. Restoring the record returned all 8 tests to passing.
- The opposite property was checked too. With the live record set to
  `- Result: FAIL` and its labels intact, all 8 tests passed. The suite does not
  force the record to claim success.
- The first outstanding condition — that the check runs in continuous
  integration on the exact commit — is now met. The fix landed on `main` as
  commit `8ed5a0b`. Quality run `35488910660` ran `npm test` on that commit and
  passed, so the new check does run in continuous integration. Release run
  `35489286757` also passed on that commit, but it passed by skipping its work,
  so it is not evidence for this condition.
- The second condition — that a release run reaches "Prepare package evidence"
  with the record intact — is not met, and this ticket stays in Verification
  Pending because of it. On that run the "Update release pull request or
  publish" job was skipped: it runs only when changesets are pending or a
  publication is due, and neither was. "Prepare package evidence" never
  executed, and the release-time gate has not been exercised. That step runs on
  a publication run, so a publication run is what will settle this. Not having
  seen the release gate run is not evidence that it works.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: Problem 004 (Problem Backlog Parser Couples to an
  Unexplained Exact Heading), which is the same coupling between reader-facing
  text and a machine-read marker, on a different surface. Neither blocks the
  other, and a decision that resolves the coupling would resolve both.

## Related

- ADR-0023, Mandatory Cognitive-Accessibility Review for Published Content.
- `scripts/verify-release-readiness.mjs` holds both checks:
  `assertReadinessMarkerLabels` for the always-true label contract and
  `assertReadinessMarkers` for the publication-time verdicts.
- `tests/docs/published-content-review.test.mjs` puts every path under `docs/`
  in the rewording review scope, which is why the two controls meet.
- The path `docs/reviews/current-release-readiness.md` is spelled out as a
  literal 15 times across 9 files: the README, the release workflow, both
  release scripts, the verifier itself, and four test files, one of which
  (`tests/llm/release-workflow.test.mjs`) asserts that the workflow contains the
  spelling rather than using it. This fix added two of those 15, in the
  verifier's new assertion messages. That is a second drift risk of the same
  family and it was left alone deliberately. A shared constant cannot be the
  single source of truth here, for two reasons. First, two of the sites are not
  JavaScript at all: one is a Markdown link, one is a shell assignment inside
  YAML. Second, the JavaScript sites do not read the same bytes — the release
  scripts read `HEAD:<path>` through git, while the new test reads the working
  tree. Problem 004 carries this follow-up so it outlives this ticket.
- The new test reads the working tree; `scripts/push-and-watch.mjs` and
  `scripts/release-and-watch.mjs` read the committed copy at `HEAD`. The test is
  therefore a pre-commit detector. A drift that is committed and then fixed only
  in the working tree reads green locally and still fails at push. That
  asymmetry is intended, and is recorded here so it is not mistaken for a bug.
- `docs/briefing/releases-and-ci.md` records the release lesson.
- Captured via `/wr-itil:capture-problem`; no existing ticket matched the
  title-only duplicate check and no hang-off candidate existed.
