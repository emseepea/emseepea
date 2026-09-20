---
status: "proposed"
date: 2026-09-20
human-oversight: pending
supersedes: ["ADR-0049"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-20
---

# Publish on Merge to a Publish Branch

**Status: proposed. What is being asked:** ratify the release shape below, or
reject it. Ratifying commits this project to publishing its packages from the
release pull request under a `next` tag, to promoting that tag to `latest` when
the pull request merges into a separate branch, to deploying the website only
when a changeset says the website changed and as part of that same promotion,
and to dropping the quality run that today follows the version pull request onto
the trunk.

It commits to five decision-level prerequisites before the first release under
this shape: creating the `publish` branch and setting its protection, since
whoever can merge to it can publish; updating the npm trusted publisher for
every publishable package; superseding ADR-0033; superseding ADR-0044 so an
automated actor may push to the trunk; and superseding ADR-0047, whose
requirement that Quality and Release stay bound to the same exact commit cannot
hold once Release is retired. All three of those decisions are ratified, so none
can be amended in place. This record supersedes ADR-0049.

It also requires implementation work identified below: rehoming everything the
retired Release workflow did after the publish, which is more than the publish
itself; the registry verifier's expectation that a release publishes rather than
promotes, and its `latest` assertion, and its hard-coded workflow path; the
initializer and guide checks, which resolve `latest` and must name `next` to
verify a release before it is promoted; the credentials for moving a dist-tag
and deprecating a package, neither of which is `npm publish` and both of which a
maintainer performs locally today; the
watched-workflow set in `scripts/push-and-watch.mjs`, which names `release.yml`
and fails closed when a run never appears; `tests/llm/release-workflow.test.mjs`,
which reads `release.yml` at module load and pins its job conditions, step
ordering and evidence text, so it breaks at import when the workflow goes; `scripts/release-and-watch.mjs`,
which is written against a pull request based on `main` and hosts two gates that
have no other call site; carrying the measured website artifact between two
workflow runs; emitting the website's presence in a release plan; enumerating
the website in `publicPackages`; and rebasing the release pull request off
`publish`, whether by changing `baseBranch` or by an option on the action.

Reassessment is due 2026-12-20.

## Context and Problem Statement

A release here publishes to npm every publishable package that the release plan
names. On 2026-09-20 one release needed six attempts before it succeeded. Five
of those attempts failed, the trunk was left broken for ten minutes in the
middle, and none of the five failures was caused by the change being released.

A changeset is a file recording a pending version bump and its release notes;
the Changesets tool consumes them to produce the bump. Today a push to `main` —
the trunk — runs the Quality workflow. When Quality succeeds, the Release
workflow starts and the Changesets action does one of two things depending on
whether changesets are waiting: it opens a version pull request, or it
publishes. Opening that pull request is the first pass through the trunk;
merging it is a second push, which runs Quality again, which starts Release
again, which publishes.

The version pull request does get Quality runs, and they do not qualify
anything. Of the six most recent such runs, three sat at `action_required`
without starting and the rest failed — the one on 2026-09-20 reported "This run
likely failed because of a workflow file issue" rather than a test result. That
is an observation of the run history on 2026-09-20, not a derivation from any
rule, and why those runs behave that way is not established here. What follows
from it is enough: the commit that publishes is qualified once — proved good by
the quality checks once — on the merge, and that qualification sits between the
version bump landing on the trunk and the packages reaching the registry.

That gap is what broke on 2026-09-20. The version pull request merged, and
Quality then failed on the merge commit because a tool could not download a file
from the network. The trunk was left holding bumped versions and drained
changesets with nothing published, and there is no way out of that state except
another release.

The other four failures were:

- The release could not start, because the checkout was on a branch rather than
  `main`.
- It could not start again, because the readiness record named the previous
  release's packages.
- The publish reported a partial set, because a registry wait is shorter than
  the registry (Problem 010).
- A separate gate could not be satisfied at all from the working copy the work
  was done in (Problem 011).

Each of those four has its own tracked cause and its own fix. This record treats
only the stranded trunk as a problem of release shape. If that judgement is
wrong, the case for changing the shape is weaker than it appears here.

## Decision Drivers

- A release that fails partway should be recoverable by retrying the release,
  not by making a new one. How much residual exposure is acceptable is part of
  what this decision weighs.
- The commit that publishes and the commit that was built should be the same
  commit.
- The website should describe a version that exists on the registry.
- Fewer passes through the trunk means fewer chances for an unrelated failure to
  land in the middle of a release.

## Considered Options

1. **Publish on merge to a publish branch.**
2. **Keep the current shape and make the second quality run cheaper**, by
   skipping on the version commit the checks a version bump cannot affect.
3. **Keep the current shape and retry harder**, treating a failed quality run on
   a version commit as retryable and re-running it automatically.
4. **Do nothing**, and recover by hand when a release strands the trunk.

### Pros and Cons of the Options

**Option 1 — publish on merge to a publish branch**

- Good: the version commit never lands on the trunk before the packages exist,
  so the stranded state cannot occur.
- Good: one qualification pass rather than two, halving the exposure from that
  pass; the dispatched build and the merge back add exposure of their own.
- Good: the tarballs on the registry are the ones that were built and checked,
  because promotion moves a tag rather than publishing again.
- Good: a release can be installed under a `next` tag before it is promoted.
- Bad: a second long-lived branch that can drift from the trunk.
- Bad: versions reach the registry before anyone merges, so an abandoned release
  consumes them.
- Bad: a new failure mode — promotion succeeds and the merge back cannot be
  completed — whose conflicting form is worse than the one being removed. See
  Consequences.
- Bad: a failed website deploy blocks the merge back. See Consequences.
- Bad: the merged trunk is no longer qualified. See Consequences.
- Bad: publishing becomes a branch-protection question, and the npm
  trusted-publisher configuration has to move with it.

**Option 2 — cheaper second quality run**

- Good: small change, no new branch, no new failure modes.
- Good: shortens the window rather than removing it.
- Bad: does not remove the stranded state. A shorter window is still a window,
  and the failure on 2026-09-20 was a network fetch during setup, which no
  amount of check-skipping avoids.
- Bad: requires deciding which checks a version bump cannot affect, which is the
  same judgement this decision otherwise avoids having to make.

**Option 3 — retry harder**

- Good: smallest change of all, and it would have recovered the 2026-09-20 run
  without anyone noticing.
- Bad: does not remove the stranded state; it automates living with it. A
  failure that is not transient leaves the trunk exactly as stranded, and now
  after several minutes of retries.
- Bad: automatic retries hide the rate at which this happens.

**Option 4 — do nothing**

- Good: no work, no new failure modes.
- Bad: the stranded trunk recurs, and recovering it by hand means hand-authored
  version bumps pushed straight to the trunk, outside the path everything else
  takes.

## Decision Outcome

Chosen option: **publish on merge to a publish branch**, because it is the only
option that removes the stranded-trunk state rather than shortening or
automating it.

The trade is deliberate and it is not a straight improvement. The failure
removed is recoverable: nothing was published, and another release escapes it.
The failure introduced is not, in its conflicting form: the packages are on
`latest`, the merge back cannot be completed, and recovery needs a hand-authored
bump. This shape is chosen on the judgement that the removed failure is a
recurring hazard rather than a one-off — it occurred on 2026-09-20 and its cause
was an ordinary network fault of the kind that recurs — and that the introduced
one is rare, which is a prediction rather than an observation, and which the
reassessment criteria below test.

Promoting a package to `latest` and deploying the website are treated here as
the same act — publication — applied to different packages in the same release,
so they are one step rather than two. That is a choice about how a release is
reasoned about, not a technical requirement: the ordering rule in step 3 would
hold just as well with the deploy in its own workflow. What the one-step framing
buys is that a release has a single answer to "what does this publish", and no
second mechanism decides separately whether the website goes out. What it costs
is recorded in Consequences.

The shape, in the order it runs. Step 1 stays in the existing Quality workflow.
Step 2 is a new workflow file. The merge at step 3 triggers a second new
workflow file, which promotes and which also carries step 4 as a job. The
current Release workflow is retired. It does considerably more than publish, and
what it does has to be rehomed rather than dropped; the next subsection says
where each part goes.

1. A push to `main` runs the quality checks once. If they pass and a changeset
   is waiting, the same run opens a release pull request whose base is a
   `publish` branch. The job that does this depends on the quality jobs, so a
   commit whose checks failed opens nothing — today that binding is the Release
   workflow's gate on a successful Quality run, and it has to survive the move
   inside Quality. It does not publish: the Changesets action is given a publish
   script that does nothing.
2. A separate workflow, started explicitly by the step 1 job that opened or
   updated the pull request — and therefore only for a commit whose checks
   passed — builds the npm packages from the pull request head
   and publishes them under the `next` tag. It runs the semantic evaluation that
   today runs on the publication pass, because this is now the publishing
   commit; ADR-0057 requires that evidence to be bound to it. It does not
   otherwise re-run the quality checks. It publishes only versions the registry
   does not already hold, so a second push that leaves the numbers unchanged
   republishes nothing. The website is not built here: its build comes from step
   1, because the performance gate has to measure the bytes that are deployed.
3. A maintainer merges the release pull request into `publish`, and a workflow
   triggered by that merge publishes everything the release plan names: the npm
   packages by moving their `next` tag to `latest` first, and then the website
   to its deploy target. That order is required, not incidental — the website
   describes versions on the registry, so those versions have to be on `latest`
   before it goes out. Nothing is rebuilt and nothing is republished: the
   tarballs promoted are the ones step 2 built and checked, which is what
   satisfies the driver that the publishing commit and the built commit be the
   same. The merge is not squashed: squashing would replace the branch's commits
   with one new commit, and the shape depends on the published commit remaining
   an ancestor of `main`.

   The website is a package like any other here, and deploying it is how that
   package is published. It is already a workspace package that changesets
   versions without publishing to npm, so it is in a release exactly when a
   changeset names it. No changeset for the website means no deploy, in the same
   way that no changeset for a package means no publish. It no longer deploys on
   every push to `main`.

   What deploys is the build that was measured, not a rebuild. Today
   `website-performance` builds the site, enforces the performance limits and
   uploads that same build as the pages artifact, and the deploy step publishes
   that artifact — measured bytes and deployed bytes are identical by
   construction. That binding is what ADR-0033 and ADR-0038 require, and it must
   survive: what step 3 deploys is the artifact measured by the passing step 1
   run for the commit the release pull request head derives from. That is not
   always the run that opened the pull request: changesets updates an open
   release pull request on each further push to `main`. Rebuilding at the merge
   commit would deploy something no gate had measured.

   That needs plumbing that does not exist today. The pages artifact is uploaded
   and consumed inside one workflow run; under this shape step 1 and step 3 are
   different runs, so the measured build has to be carried between them.

   The website is a deliberate exception to the driver that the publishing
   commit and the built commit be the same. Its build comes from a `main`
   commit while its publication happens on the merge. For the website the
   measured-bytes binding required by ADR-0033 and ADR-0038 takes precedence.
   The npm packages have no such exception: promotion moves a tag, so the
   tarballs on `latest` are the ones built at the pull request head.
4. After everything in the release is published, the publish head — the merge
   commit on `publish`, carrying the version bump and the drained changesets —
   is merged back into `main`, without fast-forwarding, so the trunk keeps its
   own commit for the reconciliation even when it has not moved. Nothing is merged back before this point, which
   is what keeps the trunk untouched while a release is in flight. That push
   starts no quality run; see below.

### What the retired workflow did, and where it goes

Publishing is the smallest part of what `release.yml` does. After the Changesets
step it verifies release readiness, assembles `RELEASE-EVIDENCE.md`, reads the
packages back from the registry, repacks them, records each one's integrity and
provenance attestation, installs them clean into an empty project, runs
`npm audit signatures`, exercises the installed packages, runs the initializer
containers against the registry copies, re-runs the getting-started guide checks
with the registry as the package source, writes a git tag per package, and
creates a GitHub release per package carrying its software bill of materials,
checksums and notes. None of that is optional: ADR-0085 requires registry
readback to verify the released version, integrity, signatures, provenance and
public types, and that check exists only here.

Under this shape it moves, and the `next` tag is what makes the move an
improvement rather than a translation. Everything that verifies a published
package runs at step 2, against `next`, before anyone merges — readback,
integrity and provenance capture, the clean install, the signature audit, the
installed-package checks, the initializer containers and the registry-sourced
guide checks. A release that fails them is abandoned without ever reaching
`latest`.

Two of those resolve a dist-tag rather than a version and so need changing to
run this early. `verify-registry-initializers.mjs` and the registry branch of
`getting-started-references.test.mjs` both invoke `npm init @emseepea/<name>`
with no version, which resolves `latest` — at step 2 that is still the previous
release. They fail differently, and both failures are wrong.
`verify-registry-initializers.mjs` exercises the generated project against
itself, so it would install the previous release's initializer and pass while
verifying nothing about the release being published. The guide check compares
the installed versions against `examples/tool-server/package.json` in the
checkout, which at the pull request head already carries the bumped versions, so
it would fail loudly whenever a release bumps the packages it pins — the common
case. Naming `next` fixes both at once, because the `next` initializer is built
at the pull request head and its pins match that manifest. A check that passes
vacuously is worse than the gap it closes, and one that fails on every ordinary
release is no better. Release-readiness verification and `assertReleasePullRequestPlan` also run at
step 2, on the pull request whose plan they are about. That gate is a
base-versus-head comparison, and its base is the `main` commit the head derives
from — the same commit that selects the website artifact — not the pull
request's base branch. Comparing against `publish` would carry every source
change since the last release and trip the gate's own no-non-generated-files
assertion. The plan it compares against is read from undrained changesets, which
exist on that `main` commit and not on the pull request head, so the plan comes
from the base checkout too.

Step 3 keeps what belongs to promotion: confirming each package's `latest` now
resolves to the version that was on `next`, writing the per-package git tags,
creating the per-package GitHub releases, and retiring replaced initializers.

### The checks that do not run, and why that is accepted

Step 2 publishes without re-running the quality checks. The source was checked
at step 1, but the version bump is not the source: it rewrites every package
manifest and the lockfile, and nothing checks that state.

This shape departs from the reference implementation here, which does re-run a
subset of its checks on the release pull request. The departure is proposed
deliberately and is part of what is being ratified, not a consequence of it. The
risk it accepts is narrow and real: a version bump that produces a broken
lockfile, or an internal pin that cannot resolve, reaches the registry
unchecked. The 2026-09-20 release is a live example of the same hazard one step
over — the release plan omitted eleven starter packages whose manifests pin the
server package, and only a hand-written gate caught it (Problem 001).

Under this shape that risk is partly bounded by the `next` tag: a broken version
sits on `next` rather than `latest` until someone merges, so the damage is
recoverable by not merging. It is not eliminated, because the version is
consumed either way.

The alternative is to re-run a subset of the checks on the release pull request,
as the reference implementation does. On the runs observed on 2026-09-20 a full
quality pass took between six and ten minutes, and a subset would take less; it
would also need the same explicit dispatch that step 2 already needs, so the
plumbing cost is small. If the risk is judged too high, adding that subset
changes nothing else in this shape. A narrower check would also serve: that the
bumped workspace still installs and its internal pins resolve against each
other.

### Why this removes the stranded trunk

Today the version commit lands on `main` before anything is published, so a
failure after that point leaves the trunk claiming versions that do not exist.
Under this shape the version commit lands on `publish`, and `main` receives it
only after the packages are on `latest`. A failure before the promotion leaves
the trunk untouched and the release pull request still open, which can simply be
retried.

That is why the merge back is not also run before promoting. The reference
implementation reconciles twice, once before promotion and once after, using the
same script both times; the first pass would exercise an equivalent merge before
anything is promoted, which is the apparent reason it runs there. It does not
test the later merge, which runs from a different commit after `main` may have
moved. It also puts the bumped versions on the trunk before the release
completes, which is the stranded state this record is about. Merging back only
after promoting removes that state completely, and leaves the merge back untried
until it runs. The Consequences below weigh what that costs.

### Mechanisms that have to be handled

GitHub does not start workflow runs for actions performed with the default
GitHub Actions token. The Changesets action opens the release pull request with
that token, so neither a push nor a pull-request run fires for it. The same
applies when the action force-pushes the release branch on a later push to
`main`: no synchronize run fires either. That accounts for runs that never
start; it does not account for the runs observed failing on 2026-09-20, whose
cause remains unestablished. The exemption is an explicit dispatch, which is why
step 2 is dispatched by the workflow that opened or updated the pull request
rather than triggered by the branch.

The same rule applies to the merge at step 3. A maintainer merging by hand
starts the promotion workflow normally; a merge made with the automation token
does not, and would need that workflow dispatched explicitly too.

The token rule applies a third time, to the merge back at step 4, which pushes
to `main` with the automation token and therefore starts no quality run. The
same explicit dispatch used at step 2 could make it fire; it is deliberately not
used. Today the equivalent commit — the version pull request merging into `main`
— does run the quality checks, so this shape drops a check that exists now. A
quality failure at that point can no longer strand anything, because the release
is already published; what it would report is a broken trunk, which the next
push to `main` reports anyway. The cost is recorded below.

Step 1 puts the Changesets action inside the Quality workflow, which declares
`contents: read` at workflow level and also triggers on pull requests. The
`contents: write` and `pull-requests: write` it needs must be scoped to that
job, or pull-request runs inherit them, against ADR-0033's requirement that
permissions be limited to their tasks. The existing `deploy-website` job already
scopes its permissions this way.

One further mechanism is configuration rather than platform behaviour.
`.changeset/config.json` sets `baseBranch` to `main`, and the release pull
request has to be based on `publish` instead. Whether that is a `baseBranch`
change or an option on the action is settled at implementation; it is named here
because a wrong guess surfaces at the first release.

## Consequences

### Good

- The trunk cannot be left holding versions that were never published.
- The tarballs on `latest` are the ones that were built and checked. Promotion
  moves a tag, so nothing is rebuilt at a commit no gate saw, and the provenance
  each tarball carries names the commit that produced it.
- One qualification pass per release instead of two.
- The website only ever describes versions that exist on the registry, and it
  changes only when someone said it should, through the same mechanism that
  governs every other release.
- A release can be installed under `next` before it is promoted.

### Bad

- **Versions reach the registry before anyone merges.** Step 2 publishes under
  `next`, so an abandoned release leaves those versions consumed and never
  promoted. A later push that changes the numbers strands the earlier ones the
  same way. They are visible to anyone who installs `next`, and npm does not
  allow them to be reused. This is the price of publishing once and promoting,
  rather than building twice.
- **A new and worse failure mode: promotion succeeds, merge back fails.** The
  packages are on `latest` and cannot be withdrawn, while `main` still holds the
  undrained changesets and unbumped manifests. The next release then versions to
  the same numbers and fails against versions already taken. Two causes are
  distinct. A transient failure — a network fault, a push rejected because
  `main` advanced — is recovered by re-running the merge back, and nothing is
  hand-authored. A true conflict cannot be, and recovery does need a
  hand-authored bump; that case arises only if `main` changed the same
  manifests, lockfile or changelogs while the release was in flight. The
  conflicting case is strictly worse than the stranded trunk being removed,
  where nothing was published. Nothing tries that merge in advance: merging back
  before the promotion would exercise a similar merge, though not the one that
  runs, and it is not done here because it reintroduces the stranded trunk.
- **Publication is now coupled: a failed website deploy blocks the merge
  back.** Treating the packages and the website as one act means step 4 waits
  for all of it, so a website deploy that fails after the packages are on
  `latest` reaches the same half-committed state as a failed merge back, by a
  route that has nothing to do with the packages. The reference implementation
  keeps website deployment in its own workflow precisely so a website failure
  cannot block a release; that separation is given up here, deliberately, for
  the single-answer framing set out above. The exposure is bounded by the deploy
  being the last thing that runs and by the artifact being already built and
  already measured, so what remains is the deploy call itself. Recovery is a
  re-run of the deploy followed by the merge back; nothing is hand-authored,
  because the version commits are untouched and the artifact is unchanged.
- **The merged trunk is no longer qualified.** Today the version pull request
  merging into `main` runs the quality checks on the result. Under this shape
  the merge back starts no run, so nothing checks the merged trunk until the
  next ordinary push to `main`. That is accepted deliberately: by then the
  release is published, so the check can no longer prevent anything, and its
  failure on 2026-09-20 is what this record exists to remove.
- **The registry verifier expects a release to publish, not promote.**
  `verify-registry-release.mjs` classifies a release by comparing which packages
  are present before and against after, and treats an unchanged set as no
  publication. Under this shape the packages are already present when the
  promotion runs, so that classification has to change to compare the `latest`
  tag rather than presence. `assertRegistryState` needs the same treatment and
  cannot simply be reused: it asserts that `latest` names the expected version,
  which is true after step 3 and false at step 2, where the version is on `next`
  and `latest` still points at the previous release. The verifier therefore
  gains two call sites with opposite expectations and has to become tag-aware,
  or split into a publish check and a promotion check. The same file hard-codes
  `.github/workflows/release.yml` as the expected provenance workflow path.
- **The release watch command is written against the old shape, and hosts two
  gates that have nowhere else to run.** `scripts/release-and-watch.mjs` finds
  the release pull request by `--base main --head changeset-release/main` and
  asserts its base commit, both of which change here. Two behaviours are called
  only from it: `assertReleasePullRequestPlan` in
  `scripts/verify-release-readiness.mjs`, which checks that the pull request's
  manifests and lockfile match the Changesets plan and that it carries no
  non-generated files; and `retireReplacedInitializers` in
  `scripts/retire-replaced-initializers.mjs`. Both are defined elsewhere and
  tested, but nothing else in the pipeline invokes them. The first is the
  hand-written gate that caught Problem 001, cited below as evidence that the
  accepted risk is not theoretical — so this shape must not dissolve it. Both
  are rehomed above.
- **Promotion needs credentials that are not `npm publish`.** Moving a
  dist-tag and deprecating a replaced initializer are separate npm operations,
  performed by a maintainer's local credentials today. Whether the
  OIDC-derived publish credential can perform them is not established here, and
  it has to be before the first release: finding out at promotion time leaves
  the packages on `next` with nothing able to promote them.
- **The push watcher names the retired workflow.** `scripts/push-and-watch.mjs`
  watches `quality.yml` and `release.yml` for every trunk push and fails closed
  when a watched run never appears. Retiring the Release workflow breaks the
  mandated push path for ordinary commits, not only for releases, until that set
  is updated. The same function backs the release watch.
- A second long-lived branch exists and can drift.
- Whoever can merge to `publish` can publish. The merge back also pushes to
  `main` from automation, so the trunk's protection must admit an automated
  actor — which ADR-0044 does not currently contemplate.
- A website change reaches the site only when it carries a changeset. A
  documentation fix pushed without one stays on the trunk and never deploys,
  where today it would go out on the next push. That is the intended behaviour
  and not a side effect, but it is a change of habit: the website now needs the
  same deliberate act as a package.

### Neutral

- Changesets keeps its present role. What changes is where its pull request
  points and who publishes.
- The package set and the version numbers are unchanged in content. Their
  configuration moves, as above.

## Confirmation

- A push to `main` carrying a changeset opens a release pull request based on
  `publish`, and publishes nothing.
- The workflow that publishes under `next` is started by explicit dispatch, and
  a run exists for the pull request head that is merged.
- No release pull request is opened, and nothing is published under `next`, for
  a `main` commit whose quality checks did not pass.
- Semantic evidence exists for the commit the packages were built and published
  from.
- Every published version appears under `next` before it appears under `latest`.
- The `publish` branch exists and its protection names who may merge to it.
- Merging the release pull request moves each package's `latest` tag to the
  version already on `next`, and the merge is not squashed.
- No tarball is republished at the merge: each package's `latest` resolves to
  the tarball step 2 published, and its provenance names the pull request head.
- Nothing is merged back to `main` until everything the release plan names is
  published.
- The website deploys in the same step that promotes the packages, after those
  packages are on `latest` and before anything is merged back.
- The merge back starts no quality run.
- After a release, the publish commit is an ancestor of `main` and no consumed
  changeset remains on `main`. The two branches do not hold the same commit; a
  merge back creates a new one.
- A failure between opening the pull request and promoting leaves `main`
  unchanged and the release retryable without a new release.
- Every publishable package's npm trusted publisher names the publishing
  workflow before the first release under this shape.
- The push watcher names the workflows this shape actually runs, and an ordinary
  push to `main` completes its watch.
- Before any promotion, the released packages are read back from the registry
  and their version, integrity, signatures, provenance and public types are
  verified, as ADR-0085 requires.
- Before any promotion, the packages install clean into an empty project, pass
  `npm audit signatures`, and satisfy the initializer and guide checks against
  the registry copies rather than the workspace. Those checks name `next`
  explicitly, so they cannot pass by resolving the previous release.
- The release pull request's manifests and lockfile are checked against the
  Changesets plan, and it carries no non-generated files.
- Every released package ends with a git tag and a GitHub release carrying its
  bill of materials, checksums and notes.
- Replaced initializers are retired after promotion.
- A release whose plan includes the website deploys it; a release whose plan
  does not leaves the deployed site untouched.
- The website is versioned only by a changeset naming it, never as a dependent.
- What is deployed is the build the performance gate measured, not a rebuild.
- A push to `main` that changes the website without a changeset does not deploy
  it.

## Reassessment Criteria

Revisit:

- If abandoned releases consume enough versions to make the numbering
  confusing, or if anyone installs a `next` version that was never promoted.
- If the website acquires a workspace dependency. It would then deploy on
  releases nobody asked it to.
- If website changes routinely ship without a changeset and the site goes
  stale.
- If a version bump reaches the registry broken. The risk accepted above would
  have bitten, and the release pull request would need a resolve check.
- If a merge back conflicts after a successful promotion, rather than failing
  transiently and recovering on a re-run.
- If a website deploy failure blocks a merge back after the packages are
  promoted.
- If a broken merged trunk goes undetected long enough to matter, because no
  quality run follows the merge back.
- If branch protection on `publish` proves unworkable.
- If the number of published packages grows enough that publishing wants
  splitting.

## Related

- Supersedes ADR-0049, whose confirmation criteria require the release pull
  request to target `main` and the release to run from a checkout on `main`.
  Both change here. ADR-0049 also governs the watched exact-head release merge,
  which becomes a maintainer's merge under this shape.
- ADR-0033 records hosting the website on GitHub Pages and deploying only
  checked static output from the selected revision. Nothing in it names the
  trunk or a deployment trigger — no ratified decision does; that behaviour
  lives only in `quality.yml`. What this record changes for ADR-0033 is which
  revision is selected: the measured revision and the publishing revision
  diverge here, which its "selected revision" wording does not anticipate.
  ADR-0033 is ratified, so implementing this means superseding it rather than
  editing it.
- ADR-0047 requires Quality and Release to remain bound to the same exact
  commit, a binding inherited through its successor chain. Retiring Release
  makes that criterion unholdable, so ADR-0047 is superseded rather than edited.
  Its other release-facing criteria survive: the initializer qualification scan
  is untouched by step 1, and the signature, integrity, provenance and
  clean-install checks are rehomed to step 2 rather than dropped.
- ADR-0085 requires registry readback to verify the released package version,
  integrity, signatures, provenance and public types. Preserved by running that
  readback at step 2 against `next`, before anything is promoted.
- ADR-0057 requires readable semantic evidence to be uploaded by exact-commit
  release CI. Preserved rather than superseded: step 2 runs the semantic
  evaluation on the commit the packages are published from, which is the commit
  that criterion is about.
- The website is already in the release plan when a changeset names it —
  `@emseepea/website` is a private workspace package and
  `.changeset/config.json` carries
  `privatePackages: { version: true, tag: false }`, so changesets versions it
  without publishing it, and `assertReleasePullRequestPlan` in
  `scripts/verify-release-readiness.mjs` already accounts for private packages.
  So the plan already contains the answer. Reading it out is a small new step:
  nothing today emits "this release includes the website" to a workflow, and the
  website is absent from the publish artifacts because `publicPackages` in
  `scripts/public-packages.mjs` does not enumerate it at all.
- ADR-0044 defines trunk pushes as an exact-commit push of local `HEAD`, watched
  by workflow identity and exact SHA, with no automated-actor path. The merge
  back needs an automated actor, and retiring the Release workflow changes the
  watched set for every trunk push, so ADR-0044 is superseded rather than
  edited. Its own reassessment criterion — Quality and Release replaced by one
  exact-commit workflow — is approached but not met: Quality stays and Release
  becomes two workflows, so there are three.
- ADR-0038 requires the selected publication build to pass the performance
  budget. Preserved by deploying the measured artifact rather than a rebuild;
  it would be broken by rebuilding at the merge commit.
- Risk R010 records guides and examples drifting from released packages. Under
  this shape the guide paths and the registry versions move together, because
  promoting and deploying happen in the same release. ADR-0035 carried the same
  requirement but is superseded, and its successor chain ends at ADR-0047, which
  does not carry it — so R010 is where that concern currently lives.
- Problem 010 records the registry wait that reported a complete publish as
  partial. Independent of this decision, and it applies to step 2 now rather
  than to the merge.
- Problem 011 records the gate that cannot be satisfied from a worktree, and the
  branch assertion this decision would revisit.
- Problem 001 records the release plan omitting starter packages when an
  embedded template dependency changes. Unchanged by this decision, and the
  reason the accepted risk above is not theoretical.
- The reference implementation is `voder-mcp-hub`: `main-pipeline.yml`,
  `publish-pipeline.yml`, `release-pr-preview.yml`, `website-deploy.yml` and
  `scripts/merge-publish-back.sh`. That project deploys a service rather than
  publishing packages, so the shape transfers and the publishing step does not.
  It also differs in three respects chosen deliberately here: it re-runs a
  subset of its checks on the release pull request, it reconciles onto the trunk
  before promoting as well as after, and it keeps website deployment separate so
  a website failure cannot block a release. This record takes the other side of
  all three. The cost of the second and third is recorded in Consequences above;
  the cost of the first is in "The checks that do not run, and why that is
  accepted".
