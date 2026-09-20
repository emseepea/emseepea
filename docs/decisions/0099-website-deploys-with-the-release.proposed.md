---
status: "proposed"
date: 2026-09-21
human-oversight: confirmed
oversight-date: 2026-09-21
supersedes: ["ADR-0033"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-21
---

# Website Deploys with the Release

This is one of three prerequisite supersessions ADR-0098 commits to, which that
record requires because a ratified decision is superseded rather than amended.
The decision below is its own, and Tom Howard ratified it on 2026-09-21 after
reading it.

## Context and Problem Statement

ADR-0033 chose GitHub Pages for the website and required that only checked
static output be deployed from the selected revision. It named no trigger, and
none of its four confirmation criteria anticipated the selected revision and the
publishing revision being different commits.

Under ADR-0098 they are. The website is built and measured by the quality run on
a `main` commit, and published when the release pull request derived from that
commit merges into `publish`. ADR-0033's "the selected revision" no longer picks
out one thing.

## Decision Drivers

- Keep the binding ADR-0033 exists to protect: deployed bytes are measured bytes.
- Say which revision is selected when two are in play.
- Change nothing about hosting, action pinning or credential scope.

## Considered Options

1. **Name the measured revision as the selected one.**
2. **Rebuild at the publishing revision**, making the two the same by
   discarding the measurement.
3. **Leave ADR-0033 as it is** and let each reader decide which revision it
   means.

### Pros and Cons of the Options

**Option 1 — name the measured revision as the selected one**

- Good: keeps the binding ADR-0033 and ADR-0038 both rest on — deployed bytes
  are measured bytes.
- Good: changes nothing about hosting, pinning or credential scope.
- Bad: the artifact has to survive between two workflow runs, which needs
  plumbing that does not exist.

**Option 2 — rebuild at the publishing revision**

- Good: one revision, no ambiguity, no artifact to carry.
- Good: the deployed site would match the commit that published it exactly.
- Bad: it deploys bytes no gate measured, which is what the performance budget
  exists to prevent. ADR-0038 requires the selected publication build to pass
  that budget, and a build nobody measured has not.

**Option 3 — leave ADR-0033 as it is**

- Good: no work.
- Bad: "the selected revision" now picks out two different commits, so the
  criterion cannot be checked. A criterion that cannot be checked is not a
  control.

## Decision Outcome

Chosen option: **name the measured revision as the selected one**, because the
measurement is the thing ADR-0033 protects and a rebuild would deploy bytes no
gate had seen.

GitHub Pages remains the host. Deployment happens when a release publishes, not
on every push to `main`, and only when a changeset names the website. What is
deployed is the artifact built and measured by the passing quality run for the
`main` commit the release pull request head derives from. Actions stay pinned,
permissions stay scoped to their jobs, and pull requests still receive no
deployment credentials.

Rebuilding at the publishing commit is rejected for the reason ADR-0038 gives:
the performance budget is a property of a build, and a build nobody measured has
not passed it.

## Consequences

### Good

- The measured-bytes binding survives a shape where the two revisions differ.
- The site changes only when someone asked for it, through the same mechanism
  that governs every other package.

### Bad

- The measured artifact has to be carried between two workflow runs, which is
  plumbing that does not exist today.
- The deployed site can lag the trunk. A website change pushed without a
  changeset stays unpublished until one accompanies it.
- Because the deploy happens inside the step that publishes the packages, a
  failed deploy blocks the merge back and leaves the release half-committed.
  ADR-0098 records that cost in full and bounds it.

### Neutral

- Hosting, action pinning and credential scope are unchanged from ADR-0033.

## Confirmation

The first four criteria restate ADR-0033's, with the first reworded to name the
measured revision and the second split out to say which revision that is. The
last two are new.

- Only checked static output is deployed, and it is the output the performance
  gate measured.
- The deployed artifact comes from the passing quality run for the `main` commit
  the release pull request head derives from, not from a rebuild.
- Workflow actions are pinned and permissions are limited to their tasks.
- Pull requests cannot access deployment credentials.
- Guide checks and the website performance gate pass before publication.
- A push to `main` without a website changeset deploys nothing.

## Reassessment Criteria

Revisit:

- If carrying the artifact between runs proves unreliable.
- If the site routinely lags the trunk far enough to mislead readers.
- If the website acquires a workspace dependency that puts it in releases nobody
  asked it to join.

## Related

- Supersedes ADR-0033, which chose the host and named no trigger.
- ADR-0098 is the release shape that makes this supersession necessary.
- ADR-0038 requires the selected publication build to pass the performance
  budget, and is why the rebuild option is rejected.
- ADR-0098 also records what coupling the deploy into the publish step costs: a
  failed deploy blocks the merge back.
