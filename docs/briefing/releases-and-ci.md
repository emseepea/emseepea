# Releases and Continuous Integration

## Exact release evidence

Release completion is exact-commit and exact-workflow evidence. The OpenAPI
initializer release completed at `07430957d9e376b84761d85ec4f4b5aa336c391c`
with Quality run `34554628933` and Release run `34555128253`, attempt 3. The
evidence includes a registry quickstart, package signatures and attestations,
matching release and registry tarballs, and the unchanged no-spec example.

<!-- signal-score: 1 | last-classified: 2026-10-06 | first-written: 2026-09-11 -->

## Concurrent trunk activity

`push:watch` correctly fails closed when the workflow for the exact commit is cancelled by
newer trunk activity. Adopt or rebase the newer `main`, then rerun gates against
the new exact head rather than treating the cancelled run as release proof.

<!-- signal-score: -1 | last-classified: 2026-10-06 | first-written: 2026-09-11 -->

## First-package trusted-publisher preflight

Before `release:next`, query each canonical npm package name without credentials.
Treat only HTTP 404 as a missing package and stop with separately authorized
first-package setup guidance. Other registry failures remain errors. Package existence
does not prove trusted-publisher configuration, and the promotion token must not
create a package or version.

<!-- signal-score: 2 | last-classified: 2026-10-06 | first-written: 2026-09-23 -->

## Repair the approved release path

Check the existing exact-head release evidence before recommending a new merge
control. In this session, adding required checks from a manually dispatched
workflow blocked PR #143 despite a passing Release run. Only those protection
additions were removed, restoring the original GitHub configuration. The
ordinary release watcher then completed promotion, website deployment, records
and merge-back. A release failure does not by itself authorize a new gate.

<!-- signal-score: 1 | last-classified: 2026-10-06 | first-written: 2026-10-06 -->

## Immutable replacement candidates

Occupied npm versions cannot be overwritten. The successful replacement used
fresh versions from one frozen candidate, and verified its tree matched official
generation from the checked source. Keep that candidate unchanged while retrying
registry verification. Release run `37389531442`, attempt 2, checked candidate
`62ac79a3153f9f98c488163ff07a2522fb18c67e`; Publish run `37404060722` promoted it
and merged publish back into main at `ab8f75fa93fef42a437bfc137b104e092b052bbd`.

<!-- signal-score: 1 | last-classified: 2026-10-06 | first-written: 2026-10-06 -->

## Registry metadata is not tarball availability

A published version can have correct metadata while its tarball still returns
HTTP 404. In Release run `37389531442`, attempt 1, the OpenAPI initializer
`0.1.7` tarball failed while metadata had the expected git head. It later returned
200 without changes; retrying the failed job on the same candidate passed.
Verify metadata, tarball bytes and provenance separately; do not regenerate a
candidate solely because the registry is still propagating.

<!-- signal-score: 1 | last-classified: 2026-10-06 | first-written: 2026-10-06 -->

## Exercise recovery through its real CLI

An imported helper test did not expose the recovery CLI's awaited dynamic-import
cycle. A child-process test using the real module graph reproduced exit 13;
static import fixed it in `181c0431`. Remote PR metadata can also lag a completed
push. Commit `b8959680` bounded the existing head-visibility wait while retaining
the final exact-head comparison and remote recheck. These are repairs to the
existing path, not reasons to add a second release protocol.

<!-- signal-score: 1 | last-classified: 2026-10-06 | first-written: 2026-10-06 -->
