---
status: done
story-id: qualify-each-outgoing-branch-tip-before-push
reported: 2026-09-24
decision-makers: [Tom Howard]
problems: [P005]
jtbd: [JTBD-101]
rfcs: [RFC-001]
story-maps: [STORY-MAP-001]
estimated-effort: S
---

# STORY-001: Qualify Each Outgoing Branch Tip Before Push

**Reported**: 2026-09-24
**Problems**: P005
**JTBD**: JTBD-101
**RFCs**: RFC-001
**Story Maps**: STORY-MAP-001
**Estimated effort**: S

## User value

In order to keep locally reproducible failures out of remote continuous
integration, as a framework maintainer, I want each outgoing branch tip checked
from a clean install before push.

## Acceptance criteria

- [x] A qualification command starts only from a clean committed checkout, runs
      `npm ci` before the existing `npm test`, and writes no evidence when either
      command fails.
- [x] Qualification records the exact commit only after confirming that `HEAD`
      is unchanged and the checkout remains clean.
- [x] The repository-owned `pre-push` hook rejects every non-deletion outgoing
      branch tip without evidence for its exact commit.
- [x] Behavioural checks cover missing evidence, evidence for an earlier commit,
      multiple outgoing tips, and the deletion-only exemption.
- [x] The hook uses a tracked native Git implementation, adds no dependency,
      path classifier, or second test contract, and its installation works in a
      fresh clone or worktree.
- [x] Maintainer documentation uses the repository's npm-script command
      contract and keeps `npm run push:watch` as the separate `main` push flow.
- [x] Risk R015 stays at 15 until the behavioural checks pass and a real push
      demonstrates the gate.

## Driving problem trace

P005 records that an unqualified branch push sent locally reproducible failures
to remote continuous integration because no exact-commit push gate existed.

## JTBD trace

JTBD-101 requires maintainers to bind trustworthy verification evidence to the
exact commit before they publish or share it.

## Implementation notes

Implemented the tracked native `pre-push` hook, `npm run hooks:install`, and
`npm run push:qualify`. Behavioural checks cover failed qualification,
unchanged clean-checkout binding, missing evidence, stale evidence, multiple
outgoing tips, deletion-only pushes, and fresh clone/worktree installation.
The installed hook accepted governed push commit
`0c28ae0cf68c345c3ca64f6cdafba497c06b0116`, and GitHub Quality run
[`35964172151`](https://github.com/emseepea/emseepea/actions/runs/35964172151)
passed for that exact commit.

STORY-001 moved to done using the documented recovery for a lifecycle deadlock
where the story can finish before the related RFC record can move. This does
not change RFC-001's recorded status. The recovery is tracked as P508.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)

## Related

- [ADR-0106: Clean-Install Exact-Commit Branch Push Gate](../../decisions/0106-clean-install-exact-commit-branch-push-gate.proposed.md)

(captured via /wr-itil:capture-story; expand at next /wr-itil:manage-story invocation)
