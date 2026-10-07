# Problem 021: Release Troubleshooting Adds Unnecessary Controls

**Status**: Open
**Reported**: 2026-10-06
**Priority**: 9 (Medium) - Impact: 3 × Likelihood: 3 - observed troubleshooting scope drift disrupted release delivery
**Origin**: internal
**Effort**: S - document and exercise an evidence-first troubleshooting strategy
**WSJF**: 9.0 - Priority 9 × Open multiplier 1.0 / Effort 1
**JTBD**: JTBD-101 - publish installable packages safely
**Persona**: framework-maintainer

## Description

The assistant expanded release troubleshooting into GitHub publish-branch
protection changes. It recommended and added required status checks and
administrator enforcement after a manually dispatched workflow, before
establishing that the original release flow required either change.

Release PR #143 remained blocked despite a successful release check. The extra
controls required rollback before the standard release command could finish.

## Symptoms

- [Release run 37389531442](https://github.com/emseepea/emseepea/actions/runs/37389531442)
  passed, but PR #143 could not merge through the configured flow.
- The assistant's `required_status_checks` and `enforce_admins` additions
  changed the conditions for finishing the release.

## Workaround

Restore the original configuration by deleting only those assistant additions.
Run the existing `release:watch` command against the checked candidate. The
session completed that path without `--admin`.

## Impact Assessment

- **Who is affected**: maintainers completing a checked package release.
- **Frequency**: observed in this session; recurrence depends on troubleshooting
  decisions that expand beyond the actual blocker.
- **Severity**: delivery is interrupted and recovery work increases.
- **Analytics**: PR #143, successful release checks, and the rollback outcome.

## Root Cause Analysis

The assistant treated additional enforcement as part of fixing the release
before checking the existing release evidence and the smallest actual blocker.
The added controls then became a separate blocker. Restoring the original flow
allowed the standard command to complete.

### Investigation Tasks

- [x] Distinguish the successful release checks from the blocked merge.
- [x] Restore only the assistant-added protection fields.
- [ ] Document a troubleshooting strategy that checks existing evidence first.
- [ ] Exercise that strategy in a later release before lifecycle closure.

## Proposed Fix Strategy

Write a short strategy guide: check the existing release command, candidate
identity, workflow result, and exact blocker before recommending a control
change. Restore a verified original path when the assistant's additions caused
the blockage. This proposal adds no source code, gate, or branch-protection rule.

## Session Evidence

The standard command merged candidate
`62ac79a3153f9f98c488163ff07a2522fb18c67e` into publish commit
`24f8a22f38a71610953f0a0322c10b3d04c944c9` without administrator bypass.
[Publish run 37404060722](https://github.com/emseepea/emseepea/actions/runs/37404060722)
passed all jobs. Merge-back commit
`ab8f75fa93fef42a437bfc137b104e092b052bbd` preserved the release on trunk.
This captures the restored outcome; the strategy remains proposed.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: P018

## Related

Captured via `/wr-itil:capture-problem`. Fresh-context hang-off review returned
`PROCEED_NEW`: P001 concerns initializer bumps; P014 dependency ownership;
P016 test timing; P018 occupied versions; P003 package-name preflight. None
covers assistant-added controls or the proposed troubleshooting strategy.
