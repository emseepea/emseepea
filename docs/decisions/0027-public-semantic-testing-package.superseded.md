---
status: "proposed"
date: 2026-08-28
human-oversight: confirmed
oversight-date: 2026-08-28
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-28
supersedes: ["ADR-0019"]
---

# Public Semantic Testing Package

## Context and Problem Statement

Em See Pea checks whether a language model understands MCP results, not only
whether a server returns valid data. That machinery currently lives in the
repository harness and hard-codes each example's server, MCP operations, and
expected paths. Examples can use it inside this monorepo, but adopters cannot
reuse the capability that distinguishes Em See Pea from other MCP frameworks.

## Decision Drivers

- Make semantic testing available to adopters as part of the product.
- Keep each example's question, critical facts, and meaning criteria beside the
  example.
- Remove duplicated server startup, official-client calls, evidence capture,
  model isolation, and judgment code.
- Preserve real MCP-path evidence, three answers, three judgments, and no
  semantic retries.
- Keep example boilerplate small.
- Avoid coupling testing helpers to `@emseepea/server` so they can test any
  Streamable HTTP MCP server.
- Publish only MIT-licensed package contents and dependencies.

## Considered Options

1. **One public `@emseepea/testing` package (chosen)** - Publish deterministic
   MCP helpers and the semantic test runner as one product package.
2. **One private testing workspace** - Centralize the monorepo examples without
   making semantic testing available to adopters.
3. **Keep root-only helpers** - Leave the existing harness in `tests/` and
   `examples/test-support.mjs`.
4. **Separate protocol-test and semantic-test packages** - Publish two packages
   before there is evidence that their shared server and MCP-client machinery
   needs independent ownership.

## Decision Outcome

Chosen option: **"One public `@emseepea/testing` package"**, because semantic
qualification is a product capability and its deterministic and model-backed
checks share the same server lifecycle and official MCP client boundary.

`@emseepea/testing` is a public MIT package. It helps projects:

- start an MCP server for tests;
- call that server through the official MCP client;
- define a semantic test case with the question, expected facts, and pass
  rules;
- collect evidence from tool calls, resource reads, and prompt rendering;
- run Promptfoo against the collected material;
- run repeated model answers and judgments;
- write evidence that is safe to share; and
- run one semantic case through a command-line tool.

### Package Scope

Each example keeps its ordinary assertions and one semantic case describing
the server entry point, MCP operations, question, critical facts, and meaning
criteria. Required path evidence is derived from those operations rather than
repeated in a central map. Examples use `@emseepea/testing` as a development
dependency and expose short deterministic and semantic test commands.

The package does not depend on `@emseepea/server`. It directly pins the public
MCP client and Promptfoo versions it uses. Claude Code remains an optional
development peer or caller-supplied executable because its licence is not MIT;
it is not bundled into the package. Provider credentials, GitHub permissions,
exact-release gating, artifact upload, and retention remain repository or
adopter workflow concerns.

### Release Scope

`@emseepea/server` and `@emseepea/testing` are the publishable packages. React
and Tailwind packages remain private until separately approved. Examples and
the monorepo root remain private. Both public packages are released through
Changesets using the `next` tag and npm trusted publishing. The release must
prove which commit was tested and published. This expands and supersedes
ADR-0019 without weakening its release controls.

## Consequences

### Good

- Adopters can run the same meaning checks used by Em See Pea's examples.
- Example configuration becomes smaller and no longer depends on root-owned
  hard-coded maps.
- Deterministic and semantic tests share one maintained MCP lifecycle.
- The package can test Em See Pea servers and other Streamable HTTP servers.
- Release evidence continues to prove the exact MCP path and model result.

### Neutral

- Examples still own domain-specific questions, facts, and criteria.
- Authentication and release policy remain outside the package.
- Promptfoo and the official MCP client become package dependencies.

### Bad

- A second public package needs versioning, documentation, support boundaries,
  trusted-publisher setup, and clean-install qualification.
- Model providers remain variable external dependencies.
- The public testing API must remain compatible or be versioned when evidence
  and provider contracts change.

## Confirmation

- `@emseepea/testing` is public under MIT with no dependency on
  `@emseepea/server` or bundled proprietary model CLI.
- Every runnable example imports the package as a development dependency and
  owns one deterministic test and one semantic case.
- No central map repeats example server paths, operations, or expected MCP
  paths.
- One example command runs only that example's deterministic checks; one runs
  only its semantic check.
- Semantic checks collect data through the official MCP client.
- They ask the model three times and judge each answer three times.
- They fail when required evidence is missing, the answer misses critical
  facts, or the answer gets the meaning wrong.
- They fail if the model uses tools, takes extra turns, or retries.
- Package tests cover tool, resource, prompt, progress, authentication,
  cancellation, invalid cases, provider failure, and redacted evidence.
- Clean packed installs and public smoke tests pass on supported Node versions.
- Changesets and the existing release workflow publish both approved packages
  through the `next` npm tag.
- The release record shows which commit was tested and published.
- The root, examples, React package, and Tailwind package remain unpublished.

## Pros and Cons of the Options

### One Public Testing Package

- Good, because adopters receive the product's distinguishing capability.
- Good, because shared deterministic and semantic plumbing has one owner.
- Bad, because it creates another supported public API and release artifact.

### One Private Testing Workspace

- Good, because it removes monorepo duplication without expanding publication.
- Bad, because adopters still cannot use the semantic testing capability.

### Keep Root-Only Helpers

- Good, because it requires no package work.
- Bad, because example and adopter setup stays coupled to private repository
  layout and hard-coded maps.

### Separate Protocol and Semantic Packages

- Good, because adopters could install only one testing layer.
- Bad, because both layers currently share the same lifecycle and client code,
  so the split adds versioning and dependency boilerplate without evidence.

## Reassessment Criteria

Reassess if deterministic and semantic testing acquire genuinely independent
consumers, the model runner can no longer remain provider-isolated, Promptfoo
cannot support the required evidence, a non-MIT dependency would enter the
published package, or package size and installation cost become unreasonable.
