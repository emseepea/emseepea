---
status: "proposed"
date: 2026-09-05
human-oversight: confirmed
oversight-date: 2026-09-05
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-05
supersedes: ["ADR-0042"]
---

# Latest as the Default Public npm Channel

> Tom Howard selected publication of all public packages to `latest` and removal
> of `@next` from current commands on 2026-09-05.

## Context and Problem Statement

Em See Pea publishes working pre-alpha packages, but its current initializer
commands require readers to add `@next`. npm users normally expect an unqualified
install or initializer command to select the recommended release. The extra tag
makes every starting command longer and suggests that the published packages
are not the versions people should use.

The package maturity must remain explicit without making the normal npm path
unnecessarily difficult.

## Decision Drivers

- Make each documented `npm init` command direct and unsurprising.
- Keep one release channel across all public Em See Pea packages.
- Preserve honest `0.x` and pre-alpha stability language.
- Retain Trusted Publishing, provenance, qualification, and registry readback.
- Keep one initializer package per example and one maintained template source.

## Considered Options

1. **Publish all public packages to `latest`**: make qualified releases the
   default npm install and initializer versions.
2. **Keep all public packages on `next`**: require `@next` in every current
   install and initializer command.
3. **Use `latest` only for initializers**: make starter commands shorter while
   library packages remain on `next`.

## Decision Outcome

Chosen option: **"Publish all public packages to `latest`"**, because the
qualified public releases are the versions Em See Pea recommends people use.
Package maturity is communicated by `0.x` versions and clear pre-alpha wording,
not by requiring an extra npm tag in every command.

All public packages use the same default channel. Current documentation omits
`@next`. Release qualification, Trusted Publishing, provenance, signatures,
software bills of materials, clean installs, semantic tests, and registry
readback remain mandatory.

There is one public initializer per maintained example:

- `@emseepea/create-tool-server`
- `@emseepea/create-api-backed-server`
- `@emseepea/create-sign-in-tool-server`
- `@emseepea/create-resources-and-prompts-server`
- `@emseepea/create-progress-streaming-server`
- `@emseepea/create-html-ui-server`
- `@emseepea/create-react-ui-server`
- `@emseepea/create-multi-instance-sqlite-server`

Each example is the only maintained template source for its initializer. The
repository does not contain a duplicate maintained template tree or use a
generator framework. Generated projects are private, accept only a simple
destination name, reject path traversal and non-empty destinations, never
overwrite files, and contain no workspace, root-relative, `file:`, or private
`@emseepea/example-*` dependency.

Generated projects retain their lint, ordinary, semantic, browser, keyboard,
and accessibility tests. One canonical public-package list drives release
automation. The release verifies package contents, provenance, software bills
of materials, registry readback, clean installation, and every documented
initializer command.

## Consequences

### Good

- `npm init @emseepea/tool-server -- my-server` uses the recommended release.
- Install and initializer commands match normal npm expectations.
- Libraries and initializers cannot drift onto different public channels.

### Neutral

- Pre-alpha releases remain `0.x` and may contain breaking changes.
- Existing `next` tags may remain as historical aliases until changed by a
  later release.

### Bad

- A user who omits a version receives the newest qualified pre-alpha release.
- Every public package must be released once to establish the new default tag.

## Confirmation

- The root release command publishes without a non-default tag override.
- Public package manifests do not set `publishConfig.tag` to `next`.
- Current README and website initializer commands omit `@next`.
- Registry verification requires each released version to be the `latest` tag
  and verifies that all public packages use the same channel.
- All public packages are versioned and pass the existing exact-commit release
  qualification and post-publication checks.
- Every example directory name matches its `@emseepea/create-*` package suffix.
- Each example remains the single maintained source for its initializer.

## Pros and Cons of the Options

### Publish all public packages to `latest`

- Good: Uses the normal npm path and one consistent channel.
- Bad: Makes the newest qualified pre-alpha release the default immediately.

### Keep all public packages on `next`

- Good: Separates pre-alpha packages from npm's default channel.
- Bad: Adds `@next` to every command and makes the recommended version look
  exceptional.

### Use `latest` only for initializers

- Good: Shortens starter commands without changing library release tags.
- Bad: Creates two public release policies and makes generated dependencies
  harder to explain.

## Reassessment Criteria

Reassess if Em See Pea introduces stable major versions, needs parallel release
trains, or cannot keep all public packages on one qualified default channel.
