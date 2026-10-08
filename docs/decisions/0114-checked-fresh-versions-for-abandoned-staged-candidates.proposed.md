---
status: "proposed"
date: 2026-10-07
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: []
reassessment-date: 2027-01-07
---

# Checked Fresh Versions for Abandoned Staged Candidates

This proposal guides implementation while production evidence and final human
ratification remain outstanding. It is not an accepted decision.

## Context and Problem Statement

The release process publishes a generated candidate to the npm package registry
under the `next` tag before that candidate is merged to the publish branch.

If that candidate is abandoned, npm still keeps the package versions it used.
Those versions are immutable: npm will not accept different package contents
for the same version later.

That creates a conflict. A later candidate from newer checked source can plan
the same version, but npm will reject it because the version has already been
used.

[Publish on Merge to a Publish Branch](0098-publish-on-merge-to-a-publish-branch.proposed.md)
accepts this consequence but does not define how to generate the replacement.
[Checked Replacement Candidates for Unpromoted Failed Releases](0111-checked-replacement-candidates-for-unpromoted-failed-releases.proposed.md)
addresses a different state in which a candidate has already merged to the
publish branch and its Publish workflow has failed. This decision addresses
only a staged candidate that was never merged to the publish branch.

## Decision Drivers

- Keep the publish branch and every `latest` tag unchanged until the replacement
  qualifies and is promoted through the ordinary release path.
- Never reuse an immutable npm version for different package bytes.
- Record exact commits for the occupied version, the proof of where it came
  from, the staging run, and the replacement plan.
- Keep the normal release gates and generated candidate structure.
- Stop recovery if the registry or release history no longer matches the
  checked recovery evidence.

## Considered Options

1. **Checked staged-candidate recovery**: commit a limited recovery receipt for
   the abandoned staged candidate. For every affected package, generate the
   next patch version on the same version line that the release planner had
   already chosen.
2. **Manual version editing**: hand-edit generated manifests and lockfiles to
   choose unused versions outside the release planner.
3. **Leave the release blocked**: retain the abandoned candidate and do not
   publish the newer checked source.

## Decision Outcome

Chosen option: **checked staged-candidate recovery**. This keeps the existing
release planner and release gates in use. Those gates include qualification
checks, provenance checks, promotion, and merge-back. It also chooses package
versions that npm has not already consumed.

The recovery receipt is a separate kind of receipt from the one used when a
Publish workflow fails after merge. It records:

- the terminal Release run that staged the occupied version;
- the exact abandoned candidate that staged the occupied versions;
- the checked source that generated that candidate;
- the unchanged `latest` baseline; and
- the fresh versions.

Only public packages in the current release plan may appear in the occupied and
fresh version maps.

A failed Release run is eligible only when every attempt passed semantic
evaluation and package publication, then stopped in one of two explicit
verification states:

- registry verification failed, while downloaded-package verification and
  artifact upload were skipped; or
- registry verification passed, downloaded-package verification failed, and
  artifact upload was skipped.

All adjacent states are ineligible. Registry integrity and provenance must
still bind the occupied version to that exact run and candidate.

For each affected package, choose the next patch version after the occupied
version. Keep the same major and minor version as the ordinary release plan.

Build the replacement candidate from the normal release source history. Use
the receipt as evidence for the abandoned candidate. Do not make the abandoned
commit an ancestor of the replacement.

## Consequences

### Good

- A newer checked source can be released without promoting or republishing an
  abandoned candidate.
- Version selection remains deterministic and is shared by generation,
  readiness checks, and registry verification.
- The publish branch and `latest` remain untouched until ordinary promotion.

### Neutral

- An abandoned staged version remains permanently present in npm history under
  its original provenance.
- The recovery receipt is consumed when the replacement candidate is generated,
  while the repository and workflow history retain the decision evidence.

### Bad

- Recovery requires registry and GitHub Actions lookups during qualification.
- The next public version may contain a patch increment that exists solely
  because an earlier staged candidate consumed the planned version.
- A second recovery path increases release-maintenance surface and needs its own
  refusal tests.

## Confirmation

Production confirms this decision only after a real abandoned staged candidate
has consumed an immutable version without changing `latest`.

The release system must then pass these checks:

- The occupied version's npm `gitHead` value, which is the source commit
  recorded by npm, and its provenance match the exact Release run and candidate
  recorded in the receipt.
- If that Release run failed, it stopped only in one of the two eligible
  verification states after staging succeeded: registry verification failure
  before any download check, or downloaded-package verification failure after
  registry verification passed.
- The recorded checked source generated that abandoned candidate and is an
  ancestor of the replacement source.
- Every `latest` tag still matches the recorded baseline.
- Fresh versions are rejected if they are missing, extra, already occupied, on
  the wrong version line, or different from the registry evidence.
- Every public package in the current plan gets only the next fresh patch, with
  normal dependent manifest and lockfile updates.
- The replacement passes the unchanged quality, semantic, package, registry,
  signature, provenance, initializer, guide, promotion, and merge-back gates.
- The replacement package set is promoted under `latest` and independently
  verified from one exact release head.

## Pros and Cons of the Options

### Checked staged-candidate recovery

- Good: preserves one checked plan and the existing release path.
- Good: fails closed against registry, workflow, or source drift.
- Bad: adds a distinct receipt schema and verifier.

### Manual version editing

- Good: can produce an unused version quickly.
- Bad: bypasses the shared planner and permits generated release files to drift.
- Bad: provides no reusable proof that the chosen version and source are safe.

### Leave the release blocked

- Good: adds no recovery machinery.
- Bad: prevents a qualified change from reaching adopters.
- Bad: requires future maintainers to resolve the same immutable-version state.

## Reassessment Criteria

Reassess this decision if any of these happen:

- npm supports replacing staged package bytes safely;
- the project stops publishing candidates before merge;
- the release planner natively models occupied pre-merge versions; or
- production recovery evidence shows that the receipt cannot keep generation
  and verification bound to one candidate.
