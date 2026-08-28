---
status: "proposed"
date: 2026-08-28
human-oversight: confirmed
oversight-date: 2026-08-28
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-28
---

# Example-Owned Oxlint with Root Orchestration

## Context and Problem Statement

Em See Pea examples are starting points, not only demonstrations. A developer
must be able to copy an example into a new folder, install it, and run its
quality checks without the monorepo. The same examples will later feed an
`npm init` project template.

A root-only Oxlint dependency or configuration would break that promise: a
copied example could contain a `lint` command but lack the tool or policy needed
to run it. The monorepo also needs one command that checks all maintained code.

## Decision Drivers

- A copied example must remain a working standalone project.
- A future `npm init` template must produce the same working quality setup.
- Every example must visibly teach linting as part of ordinary quality
  assurance.
- Example setup must remain small and easy to understand.
- Root CI must check all maintained JavaScript and TypeScript without needlessly
  reinstalling identical packages.
- Linting must remain distinct from type checking, tests, semantic checks, and
  formatting.
- The dependency must be approved open-source software.

## Considered Options

1. **Example-owned Oxlint dependency with root orchestration (chosen)** - Each
   copyable example declares Oxlint and a standalone lint command; the root
   independently checks the whole monorepo.
2. **Root-owned Oxlint dependency and policy** - Examples delegate to the root
   installation and stop working when copied out of the monorepo.
3. **Shared lint-configuration package** - Add another public package before
   shared non-default rules have proved necessary.
4. **ESLint with TypeScript support** - Use the larger ESLint plugin and parser
   ecosystem in every example.
5. **No automated linter** - Continue relying on TypeScript and tests.

## Decision Outcome

Chosen option: **"Example-owned Oxlint dependency with root orchestration"**,
because an example must carry everything needed to lint itself after it leaves
the monorepo.

Every copyable example declares the same exact Oxlint version in
`devDependencies` and exposes a self-contained command such as
`oxlint src test`. The command does not reference a root binary, root script,
or root configuration. npm workspaces and the lockfile deduplicate identical
installed versions inside the monorepo; repeating the declaration in each
manifest is executable documentation for the standalone project.

The root also declares that exact Oxlint version and runs one repository-wide
lint scan in CI. Package workspaces expose their own scoped lint commands where
useful, but root CI does not run a whole-repository scan separately for every
workspace.

No shared lint-configuration package is created. Oxlint defaults plus explicit
command-line options are sufficient until real rules need to be shared. Oxlint
does not replace TypeScript type checking, Node tests, Promptfoo semantic
checks, accessibility checks, or formatting. A disabled rule requires a narrow
reason beside the suppression.

A future project generator must emit the same Oxlint dependency and command.
The generator itself requires a later decision when it is implemented. Its
acceptance tests must create a project outside the monorepo and run installation,
linting, deterministic tests, and semantic checks there.

## Consequences

### Good

- Copied examples retain a working lint command.
- Future project templates can reuse the proven example setup.
- Every example shows the complete development dependency instead of relying on
  hidden monorepo state.
- npm deduplicates the identical dependency within the monorepo.
- No configuration package or custom rules are invented prematurely.

### Neutral

- The same exact Oxlint version appears in several manifests.
- Root and example lint commands serve different scopes.
- Formatting remains unchanged.

### Bad

- Updating Oxlint requires changing several manifests together.
- Oxlint does not provide every specialist rule in the ESLint ecosystem.
- A copied example will still need its workspace-only Em See Pea dependencies
  replaced with published versions; linting must not add another such coupling.

## Confirmation

- The root and every copyable example declare the same exact MIT-licensed
  Oxlint version compatible with supported Node 22 and 24 releases.
- Every copyable example exposes a lint command that references only paths and
  dependencies contained in that example.
- No example lint command references the monorepo root, a root script, or a
  shared private configuration.
- Root CI runs one repository-wide lint scan before type checking and tests.
- `tests/docs/example-quality.test.mjs` fails when an example omits `lint`, uses
  a different Oxlint version, or introduces a root-relative lint command.
- At least one example is copied to a temporary directory outside the monorepo;
  a clean install and its lint command pass there.
- The future `npm init` template test creates a project outside the monorepo and
  proves installation, linting, deterministic tests, and semantic checks.
- Clean monorepo checkouts pass lint on both supported Node versions.
- Intentional suppressions are narrow and state why they exist.

## Pros and Cons of the Options

### Example-Owned Oxlint with Root Orchestration

- Good, because copied examples and generated projects can lint themselves.
- Good, because npm still deduplicates the identical installation in the
  monorepo.
- Bad, because exact dependency declarations must be updated together.

### Root-Owned Oxlint Dependency and Policy

- Good, because the dependency and configuration appear in one manifest.
- Bad, because copied examples silently depend on files they no longer have.

### Shared Lint-Configuration Package

- Good, because future non-default rules could have one owner.
- Bad, because no shared custom-rule need currently exists and another package
  would add release and installation work.

### ESLint with TypeScript Support

- Good, because it has a mature and extensible rule ecosystem.
- Bad, because it requires more dependencies and configuration in every
  standalone project.

### No Automated Linter

- Good, because it adds no dependency.
- Bad, because examples would omit a basic quality practice and type checking
  cannot catch many code-quality defects.

## Reassessment Criteria

Reassess if examples stop being standalone starting points, shared non-default
rules become substantial enough to justify a configuration package, Oxlint
misses a demonstrated defect class, or the project generator needs a different
quality boundary.
