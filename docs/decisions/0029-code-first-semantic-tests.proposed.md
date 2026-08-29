---
status: "proposed"
date: 2026-08-30
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-30
---

# Code-First Semantic Tests

## Context and Problem Statement

Em See Pea must prove that a language model understands a Model Context Protocol
(MCP) result, not only that the server returned valid data. The current
`eval.yaml` format can describe one fixed sequence, but it cannot naturally
express setup, several related MCP calls, conditional checks, generated cases,
or domain-specific assertions.

Promptfoo also became a runtime dependency of `@emseepea/testing`. A fresh
installation pulled 774 packages and reported six high-severity dependency
findings. The release correctly stayed blocked.

The testing package already contains a direct runner that performs the required
answer and judgment trials without Promptfoo. We should use that runner instead
of maintaining two ways to perform the same work.

## Decision Drivers

- Let adopters write semantic checks with ordinary JavaScript or TypeScript.
- Keep each example's semantic test beside its ordinary tests.
- Support setup, cleanup, several MCP calls, generated cases, and exact
  domain-specific assertions.
- Preserve three fresh answers, three independent judgments per answer, no
  retries, no cache, and exact MCP-path evidence.
- Keep the model isolated from tools, files, credentials, and the MCP server.
- Make copied examples useful project starters with little boilerplate.
- Keep `@emseepea/testing` small enough to install and audit as a normal
  development dependency.

## Considered Options

1. **Direct code-first semantic tests** - Use Node's test runner and a small
   public helper backed by Em See Pea's direct semantic runner.
2. **Code-first Promptfoo configuration** - Replace YAML with JavaScript but
   continue using Promptfoo to run the trials.
3. **Keep Promptfoo and YAML** - Retain the current format and dependency tree.
4. **Copy model orchestration into every example** - Give each example complete
   control by duplicating the provider and evidence machinery.

## Decision Outcome

Chosen option: **"Direct code-first semantic tests"**, because normal code gives
examples the needed flexibility. The existing runner already produces repeated
answers and release evidence without Promptfoo.

Every runnable example owns a `test/semantics.test.mjs` file and a short
`test:llm` command. The file is an ordinary Node test, so it can use imports,
hooks, loops, generated cases, and `node:assert`.

`@emseepea/testing` exposes one small semantic-test helper. It starts or connects
to the server, provides an instrumented official MCP client to the test, records
the MCP operations performed by the callback, runs the model trials, and writes
shareable evidence. A test can make several tool calls, resource reads, or
prompt requests before asking its question.

The helper enforces the safety rules rather than making each example repeat
them. It runs three uncached answers and three independent judgments for each
answer. It rejects missing path evidence, retries, tool use, extra turns,
incorrect models, malformed judgments, missing critical facts, or a failed
meaning rule.

The existing isolated Claude subscription provider remains the release
provider. Removing Promptfoo does not change where credentials can go, which
model is used, how checks attach to a release, or when publication is blocked.

Promptfoo and the YAML parser are removed from `@emseepea/testing` and the
monorepo. Evidence uses product terms such as `answerTrials` and
`judgeVerdicts`, not Promptfoo-specific fields.

There is no Promptfoo compatibility layer in this change. An optional bridge
can be considered later if adopters need Promptfoo's reports or integrations.

If ratified, this decision will replace ADR-0024, ADR-0026, and ADR-0027. Their
provider, example-owned quality, and public testing-package decisions are
preserved here without the Promptfoo and YAML requirements. Until then, those
three confirmed decisions remain authoritative.

## Consequences

### Good

- Semantic tests can express real business questions and multi-step behavior.
- Examples teach ordinary testing practices instead of a project-specific YAML
  subset.
- The public testing package loses Promptfoo's large dependency tree.
- One runner owns trial counts, evidence, isolation, and failure behavior.
- Copied examples keep their checks without depending on monorepo layout.

### Neutral

- Em See Pea owns a small amount of model-trial orchestration that already
  exists in the current direct runner.
- JavaScript is the zero-setup example format. TypeScript uses the adopter's
  existing test runner or build setup.
- Provider credentials and release policy remain outside individual examples.

### Bad

- Promptfoo's report interface and plugin ecosystem are no longer available by
  default.
- The public semantic-test API must be versioned carefully.
- Existing YAML cases must be rewritten once as executable tests.

## Confirmation

- `@emseepea/testing` has no Promptfoo dependency and passes a clean
  high-severity dependency audit.
- Every runnable example owns an executable semantic test and exposes
  `test:llm` from its package.
- A copied example runs its ordinary, lint, and semantic checks using packed
  public packages rather than monorepo-only imports.
- Tests demonstrate setup, cleanup, generated cases, several MCP operations,
  authentication, and a domain-specific assertion.
- Semantic tests use the official MCP client and record request and response
  evidence for every required path.
- Each case produces three fresh answers and nine independent judgment records,
  with no semantic retries or cache.
- Tests reject missing evidence, failed critical facts, incorrect meaning,
  retries, tool use, extra turns, malformed output, wrong models, and provider
  failures.
- Claude credentials reach only the isolated model process and never the
  example server, public evidence, package, or publication step.
- The exact release revision passes all semantic cases before npm publication.
- The clean packed-install example gate finishes without installing Promptfoo.

## Pros and Cons of the Options

### Direct Code-First Semantic Tests

- Good: Maximum test flexibility with the smallest dependency and concept
  surface.
- Bad: Em See Pea maintains its direct runner and evidence format.

### Code-First Promptfoo Configuration

- Good: Removes YAML limitations while retaining Promptfoo reports.
- Bad: Keeps the large dependency tree and duplicate orchestration.

### Keep Promptfoo and YAML

- Good: Requires no migration.
- Bad: Preserves both the authoring limits and failed clean-install audit.

### Copy Model Orchestration into Every Example

- Good: Each example can customize every detail.
- Bad: Credential handling, trial counts, and evidence would be duplicated and
  would drift.

## Reassessment Criteria

Reassess if adopters need a Promptfoo integration, Node's test runner cannot
support a demonstrated use case, another provider needs a different isolation
boundary, or the direct runner cannot produce the evidence required by release
qualification.
