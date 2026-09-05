---
status: "proposed"
date: 2026-09-01
oversight-date: 2026-09-02
human-oversight: confirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-12-01
---

# Separate Example Initializer Packages

## Context and Problem Statement

Em See Pea examples are intended to become real project starting points. Copying
an example from the repository works, but it makes a developer find the source,
clone the whole repository, and extract one folder. npm already supports project
initializers through `npm init <package-spec>`.

A durable package layout is needed so every runnable example can create a new,
standalone project without duplicating a second set of template files.

## Decision Drivers

- Each command must say clearly what kind of MCP server it creates.
- A developer must be able to start from one example without cloning the monorepo.
- Existing examples must remain the only maintained template source.
- Generated projects must retain linting, ordinary tests, accessibility checks,
  and semantic language-model tests.
- Generated projects must work outside npm workspaces and contain little boilerplate.
- Pre-alpha packages and commands must use the `next` tag honestly.
- Publishing and supply-chain checks must cover every initializer package.

## Considered Options

1. **One initializer package per example** - Publish a clearly named
   `@emseepea/create-*` package for every runnable example.
2. **One initializer containing every example** - Publish `@emseepea/create`
   with a template-selection argument.
3. **Repository copying only** - Keep telling developers to clone the repository
   and copy an example directory.

## Decision Outcome

Chosen option: **"One initializer package per example"**, because each command
states the project being created and maps directly to npm's scoped initializer
convention.

The public initializers are:

- `@emseepea/create-tool-server`
- `@emseepea/create-api-backed-server`
- `@emseepea/create-sign-in-tool-server`
- `@emseepea/create-resources-and-prompts-server`
- `@emseepea/create-progress-streaming-server`
- `@emseepea/create-html-ui-server`
- `@emseepea/create-react-ui-server`
- `@emseepea/create-multi-instance-sqlite-server`

For example, `npm init @emseepea/tool-server@next -- my-mcp` runs
`@emseepea/create-tool-server@next`.

Each existing example remains the maintained template. Initializer packaging may
add a small shared build-time script, but it must not introduce a second
hand-maintained template tree or a generator framework.

Generated projects are private by default. They refuse path traversal and
non-empty destinations, never overwrite files, and contain no workspace,
root-relative, `file:`, or private `@emseepea/example-*` dependency.

## Consequences

### Good

- Each command is short and describes its resulting project.
- Developers can start without cloning or understanding the monorepo.
- Generated projects retain the examples' visible quality practices.
- The source examples and generated projects cannot drift into separate designs.

### Neutral

- Eight initializers share one implementation pattern and release workflow.
- The scoped npm command omits the `create-` prefix while the package includes it.
- Pre-alpha documentation includes the `next` tag.

### Bad

- Eight public packages require versioning, provenance, trusted-publisher setup,
  registry verification, and maintenance.
- Renaming current examples changes many documentation, test, and evidence paths.
- UI initializers also require their public React and Tailwind dependencies to be
  available from npm.

## Confirmation

- Each documented `npm init @emseepea/<name>@next -- <directory>` command creates
  the named starter in an empty destination.
- Every command refuses path traversal, a non-empty destination, and overwriting.
- Generated projects are private and contain no workspace, root-relative,
  `file:`, or `@emseepea/example-*` dependency.
- Every generated project installs, lints, builds, runs ordinary tests, and runs
  its semantic smoke test outside the monorepo.
- HTML and React projects retain their browser, keyboard, and accessibility tests.
- Existing `examples/*` directories remain the only maintained template sources.
- Changesets and the release workflow verify each initializer's package contents,
  provenance, SBOM, registry metadata, clean installation, and exact documented
  command.
- The repository uses one canonical list of public release packages.
- Public guides and package READMEs explain the commands in plain language and
  pass the required cognitive-accessibility review.

## Pros and Cons of the Options

### One Initializer Package per Example

- Good: Commands are explicit and need no template-selection flag.
- Good: Each package can evolve and version with its example.
- Bad: The registry and release workflow have eight more package surfaces.

### One Initializer Containing Every Example

- Good: One package and one release surface are simpler to maintain.
- Bad: The command needs an additional template name that users must discover.
- Bad: One package release changes even when only one example changes.

### Repository Copying Only

- Good: It creates no new packages or release work.
- Bad: It does not provide the requested npm initializer experience.
- Bad: It makes users clone unrelated project files before starting.

## Reassessment Criteria

Reassess if the package count creates material release friction, npm changes its
initializer naming rules, examples stop being standalone starting points, or
several initializers become indistinguishable in real adopter use.
