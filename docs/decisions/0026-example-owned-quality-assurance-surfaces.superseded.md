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

# Example-Owned Quality Assurance Surfaces

## Context and Problem Statement

Em See Pea examples are intended to show adopters what good framework usage
looks like. Their tests and language-model checks were previously hidden in
root-level folders, while the example packages exposed only build and start
commands. A reader could not find or run the quality checks from the example
being studied, and a future example could be added without equivalent checks.

## Decision Drivers

- Examples must teach testing and quality assurance, not only implementation.
- A developer must be able to run one example's checks from its workspace.
- Every runnable example must prove both correct MCP behaviour and correct
  language-model interpretation.
- Shared provider credentials, isolation, and release evidence must remain in
  one maintained harness.
- Example boilerplate and duplicate test execution must stay low.
- UI examples must visibly own browser, keyboard, and accessibility checks.

## Considered Options

1. **Example-owned quality commands with shared tooling (chosen)** - Each
   example owns its `test` command, `test:llm` command, ordinary test files, and
   language-model scenario. Root tooling supplies shared execution and release
   evidence.
2. **Central root test suite** - Keep all tests and semantic cases under the
   repository root and mention them from examples.
3. **Copy the complete harness into every example** - Make each example fully
   self-contained by duplicating process, MCP client, browser, and model code.
4. **Build and start checks only** - Treat compilation and manual use as enough
   evidence for examples.

## Decision Outcome

Chosen option: **"Example-owned quality commands with shared tooling"**,
because it makes quality visible where adopters learn while keeping credentials,
provider isolation, and exact-release evidence in one place.

Each runnable example exposes two commands: `test` for ordinary automated
checks, and `test:llm` for the language-model understanding check. Each example
keeps its ordinary tests under `test/` and its language-model scenario in
`eval.yaml`.

The root harness still owns Claude, Promptfoo, credentials, isolation, and
release evidence. This keeps sensitive setup in one place while letting a
developer run one example's checks from that example workspace. The private
`ui-shared` helper has focused ordinary tests but no language-model scenario
because it is not runnable.

The choice of linting tool is a separate decision and is not made here.

## Consequences

### Good

- A developer can discover and run quality checks from the example itself.
- New examples cannot silently omit deterministic or semantic checks.
- Existing test coverage moves to its owner instead of being duplicated.
- Shared credentials, provider safety rules, and release evidence stay central.
- Root CI avoids rebuilding or rerunning the same example checks unnecessarily.

### Neutral

- Small shared test helpers remain outside individual example folders.
- A direct workspace test builds the monorepo dependency chain before testing.
- Cross-example policies and framework-wide checks remain under root `tests/`.

### Bad

- Moving tests creates more files inside each example.
- Changes to shared test helpers can affect several example workspaces.
- Example package scripts must stay aligned with the central harness contract.

## Confirmation

- Every runnable `examples/*/package.json` exposes `test`, `test:built`, and
  `test:llm`.
- Every runnable example contains at least one deterministic test and one
  `eval.yaml` file referenced by the Promptfoo configuration.
- `npm test -w <example workspace>` succeeds from a clean installed checkout.
- `npm run test:llm -w <example workspace>` runs only that example's live MCP
  case through the shared Claude and Promptfoo harness.
- Root `npm test` builds once and runs every example-owned deterministic test
  exactly once.
- `tests/docs/example-quality.test.mjs` fails when a runnable example omits its
  `test` command, `test:built` command, `test:llm` command, ordinary test file,
  or `eval.yaml` scenario.
- Native and React examples run browser, keyboard, and accessibility checks
  from their own workspaces.

## Pros and Cons of the Options

### Example-Owned QA Surfaces with Centralized Shared Tooling

- Good, because quality is visible and runnable where the example is read.
- Good, because sensitive and complex model infrastructure remains centralized.
- Bad, because package scripts and shared tooling have an explicit contract to
  maintain.

### Central Root Test Suite

- Good, because all test files remain in one directory.
- Bad, because examples hide the practices they are supposed to demonstrate.

### Copy the Complete Harness into Every Example

- Good, because each folder could carry all of its implementation details.
- Bad, because duplicated browser, process, MCP, and model code would drift and
  increase maintenance and credential risk.

### Build and Start Checks Only

- Good, because it requires the least test code.
- Bad, because compilation cannot prove MCP behaviour, accessibility, failure
  handling, or correct language-model interpretation.

## Reassessment Criteria

Reassess if examples are published as independently installable repositories,
shared tooling prevents an example from being tested on its own, root CI begins
duplicating substantial work, or the Promptfoo provider contract changes enough
that example-owned cases can no longer remain simple data files.
