---
status: "proposed"
date: 2026-09-23
human-oversight: confirmed
oversight-date: 2026-09-23
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2026-12-23
---

# Bounded Stage-Only Token for npm Promotion

## Context and Problem Statement

Em See Pea publishes package versions under `next` through npm trusted
publishing, verifies those exact registry artifacts, and then promotes them to
`latest`. Trusted publishing authorizes `npm publish`, but npm does not extend
that OpenID Connect credential to moving distribution tags or deprecating
replaced initializer packages. Those later operations therefore need a separate
credential.

Creating and deleting a short-lived token for every release preserves a narrow
credential lifetime, but it makes routine publication depend on Tom being at a
computer for npm's interactive authentication. Giving continuous integration
access to the npm time-based one-time-password seed would remove that
interaction by placing both authentication factors in the same automation
boundary. Publishing directly to `latest` would avoid promotion credentials but
would also remove the existing opportunity to inspect the exact registry
artifacts under `next` before they become the default install.

The project needs a credential for promotion and deprecation that supports
unattended routine releases without widening direct publication authority or
silently becoming permanent.

## Decision Drivers

- Keep npm trusted publishing as the only mechanism that uploads new package
  versions.
- Preserve verification of the exact `next` artifacts before promotion to
  `latest`.
- Avoid interactive token creation for every routine release.
- Limit a reusable credential to the packages and operations that promotion
  actually needs.
- Keep npm's human authentication factor outside GitHub Actions.
- Make expiry visible early enough to rotate without blocking a release.
- Stop on the first rejected npm write and prevent downstream publication
  steps.

## Considered Options

1. **A bounded, stage-only promotion token with assisted rotation** - Keep one
   npm granular token in the GitHub Actions secret store for up to 90 days.
   Limit it to the selected Em See Pea packages, disable npm organisation
   access, enable two-factor-authentication bypass only for the stage-only
   package operations, and schedule a rotation reminder at least 30 days before
   expiry. Use 1Password only for Tom's interactive npm authentication during
   creation and rotation.
2. **A short-lived token for every release** - Create, install, use, and revoke
   a package-scoped token for each promotion.
3. **Publish directly to `latest` with trusted publishing** - Remove the
   promotion step and use the existing workflow-bound OpenID Connect credential
   to publish new versions directly under the default tag.
4. **Automate the npm one-time password through 1Password** - Give a 1Password
   service account and GitHub Actions enough access to obtain the npm
   time-based one-time password and manage tokens without Tom.

## Decision Outcome

Chosen option: **"A bounded, stage-only promotion token with assisted
rotation"**, because it preserves registry-artifact verification and unattended
routine promotion while restricting the reusable credential from directly
publishing a new package version.

Ratifying this ADR authorizes creating and storing that bounded npm promotion
token, configuring the release workflow to use it only for promotion and
replaced-initializer deprecation, and scheduling the rotation reminder described
below.

The token is an npm granular access token with **Read and write (stage only)**
package permission.

Its package scope is limited to:

- every name returned by `publishablePackages()` in
  `scripts/public-packages.mjs`
- every `initializerPackages[].replaces.name` value

Setup evidence records that exact package list before the secret is installed.

The token must not have npm organisation permission. It must not select all
packages or the whole `@emseepea` scope. It must not bypass two-factor
authentication for account, organisation, maintainer, access, or
token-governance actions.

The token expires no later than npm's current 90-day maximum for write-enabled
tokens. Its npm **Bypass 2FA** setting is enabled only so the two allowed
package-write operations can run unattended. Stage-only enforcement still
rejects direct `npm publish`; bypass does not widen that boundary.

Adding or replacing a package does not silently widen the token. The required
access is reviewed before the release that first needs it. The decision is
reassessed before the package set reaches npm's 50-package granular-token
ceiling.

The token is stored only as the GitHub repository Actions secret
`NPM_PROMOTION_TOKEN`. The workflow references that secret only as step-scoped
`NODE_AUTH_TOKEN` in the step that moves verified versions from `next` to
`latest` and the step that deprecates replaced initializers. It is never placed
at workflow, job, or other step scope, and no pull-request-triggered or
fork-triggered job may reference it. Tests reject any other workflow reference.
The promotion job also relinquishes `id-token: write`, so it cannot hold both
the durable npm credential and OpenID Connect minting authority. Website
deployment retains its separate OpenID Connect permission.

The token is not retained in source, local npm configuration, logs, artifacts,
or 1Password after it has been transferred to GitHub. 1Password may hold Tom's
human interactive npm authentication factor, whether that is a passkey or an
existing one-time-password setup. Neither the npm promotion token nor a
1Password service-account credential enters continuous integration.

A reminder is scheduled for at least 30 days before the recorded expiry date
and names the token, repository, expiry date, and rotation procedure. Tom Howard
owns the npm credential; Codex may perform the browser and GitHub configuration
steps while Tom provides any interactive approval npm requires.

Rotation creates a replacement with the same bounded settings and updates the
GitHub secret without exposing its value. The next real promotion provides the
write-capability proof because npm distribution-tag commands do not support a
non-mutating dry run. The previous token remains available only until that proof
succeeds, then is revoked.

A missing, expired, or authentication-invalid token stops at the first npm
write. An incompletely scoped token or a registry failure later in the loop can
still leave a partial promotion: earlier package tags may already have moved.
The workflow therefore records the exact planned package set before mutation
and withholds website deployment, merge-back, package tags, and GitHub release
records until every promotion and verification succeeds. Re-running the same
release safely skips tags already at the expected version and completes the
remaining set; unexpected registry state still stops the run.

## Consequences

### Good

- Routine releases no longer require creating an npm token each time.
- New package versions are still uploaded only by workflow-bound trusted
  publishing with npm provenance.
- The reusable credential cannot directly publish a new version.
- Exact registry artifacts remain inspectable under `next` before they become
  the default install.
- Package selection, bounded expiry, and an advance reminder reduce the chance
  that the credential becomes forgotten or unnecessarily broad.
- npm's human authentication factor remains outside continuous integration.

### Neutral

- One human-attended rotation is required at least every 90 days.
- A new or replacement package may require a token-scope update before its
  first affected release.
- During a proved rotation, the old and replacement tokens may overlap until a
  real promotion succeeds.

### Bad

- A stolen token remains reusable until it expires or is revoked.
- Stage-only limits direct publication but still permits distribution-tag
  changes and deprecation across every selected package.
- The token bypasses interactive two-factor challenges for those package-write
  operations, so possession of the token is sufficient to misuse them.
- GitHub Actions becomes a durable secret holder for release authority.
- A missed reminder can leave a release blocked after its versions have already
  reached `next`.
- Rotation proof depends on a real promotion because npm offers no safe dry run
  for a distribution-tag write.
- An incomplete package scope or mid-loop registry failure can partially move
  `latest` before the workflow stops and is retried.

## Confirmation

- npm records one granular token with **Read and write (stage only)** access,
  expiry no later than 90 days after creation, two-factor-authentication bypass
  enabled, no organisation access, and only the exact package list produced by
  `publishablePackages()` plus `initializerPackages[].replaces.name`.
- npm continues to reject direct `npm publish` with that stage-only token while
  allowing unattended distribution-tag movement and deprecation for the
  selected packages.
- Setup evidence records that exact package list, token settings, expiry date,
  and the list's position below npm's 50-package ceiling without recording the
  token value.
- GitHub records `NPM_PROMOTION_TOKEN` as a repository Actions secret and never
  reveals its value after creation.
- Only the distribution-tag promotion step and replaced-initializer deprecation
  step receive the secret, each as step-scoped `NODE_AUTH_TOKEN`;
  pull-request-triggered and fork-triggered jobs cannot reference it, and tests
  reject workflow, job, or other step scope.
- The promotion job has no `id-token: write` permission.
- New package versions continue to use npm trusted publishing under `next`, and
  the promotion token is not supplied to that publishing job.
- A promotion run moves only the versions already verified under `next` to
  `latest`, and a deprecation run can retire only a selected replaced initializer
  package.
- With the secret absent or authentication-invalid, promotion stops at the first
  npm write. Any failure before the full set is verified prevents website
  deployment, merge-back, package tags, and GitHub release records.
- A retry after partial promotion proves the already-moved tags match the
  expected versions and completes the remaining package set without rebuilding
  or republishing tarballs.
- No token value, npm passkey, or npm one-time-password seed appears in source,
  local npm configuration, workflow logs, artifacts, or continuous-integration
  access to 1Password.
- A reminder exists at least 30 days before the recorded token expiry and links
  the rotation to this repository and secret name.
- Rotation is not complete until a real promotion succeeds with the replacement
  token and the prior token is then revoked.

## Pros and Cons of the Options

### A bounded, stage-only promotion token with assisted rotation

- Good: Preserves `next` verification and removes per-release interaction.
- Good: Cannot directly publish a new package version.
- Bad: Stores reusable npm write authority in GitHub Actions.
- Bad: Needs human-attended rotation at least every 90 days and expiry tracking.

### A short-lived token for every release

- Good: Minimises the lifetime of reusable npm authority.
- Bad: Makes every release wait for interactive npm authentication and manual
  token handling.
- Bad: Repeating sensitive setup increases operational error and release delay.

### Publish directly to `latest` with trusted publishing

- Good: Uses no durable npm credential for routine releases.
- Good: Keeps publication bound to the trusted workflow and provenance.
- Bad: Removes verification of the exact registry artifact before it becomes
  the default install.
- Bad: Replaces the ratified publish-then-promote release shape.

### Automate the npm one-time password through 1Password

- Good: Could reduce human interaction during credential management.
- Bad: Places both authentication factors inside the same automation boundary.
- Bad: npm requires interactive authentication for token-governance operations,
  so it does not provide a supported unattended rotation path.

## Reassessment Criteria

Reassess if npm trusted publishing gains bounded support for distribution-tag
changes and deprecation, npm changes the 90-day write-token limit, npm provides
a safe non-mutating permission check or supported unattended granular-token
rotation, a token is exposed or misused, a rotation or expiry blocks a release,
the package set approaches the 50-package granular-token limit, or the project
no longer verifies releases under `next` before promotion.
