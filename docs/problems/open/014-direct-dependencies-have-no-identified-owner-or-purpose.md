# Problem 014: Direct Dependencies Have No Identified Owner or Purpose

**Status**: Open
**Reported**: 2026-09-23
**Priority**: 10 (High) — Impact: 2 × Likelihood: 5 — the current cost is dependency and maintenance overhead, and the two direct dependencies are installed on every applicable clean install despite having no identified owning import
**Origin**: internal
**Effort**: M — confirming safe removal requires manifest and lockfile changes plus clean-install, packed-package, and full-suite evidence
**JTBD**: JTBD-101
**Persona**: framework-maintainer

## Description

The root `package.json` declares `@opentelemetry/context-async-hooks`, and
`examples/database-schema-server/package.json` declares
`@modelcontextprotocol/client`. Repository-wide source inspection found no
import or documented runtime, test, build, or release purpose owned by either
declaration in its workspace.

This is an ownership and necessity concern, not proof that either dependency
can already be removed safely. Unowned direct dependencies expand the installed
graph, lockfile, software bill of materials, upgrade work, and supply-chain
surface. Clean-install and full-suite evidence must confirm whether each
declaration is redundant or whether an undocumented purpose needs to be made
explicit.

## Symptoms

- Neither direct dependency has an identified importing source file in its
  owning workspace.
- The root OpenTelemetry tests import the API, metrics SDK, and trace SDK, but
  not `@opentelemetry/context-async-hooks`.
- The database-schema example does not import
  `@modelcontextprotocol/client`, while other examples that use the client do.

## Workaround

Keep both declarations pinned and covered by the existing lockfile and
vulnerability checks until clean-install and full-suite evidence establishes
their purpose or safe removal.

## Impact Assessment

- **Who is affected**: maintainers updating dependencies and anyone installing the affected workspace graphs.
- **Frequency**: every applicable dependency installation and dependency-review cycle.
- **Severity**: minor ongoing overhead; a compromised unnecessary dependency would realise the linked supply-chain risk.
- **Analytics**: two direct dependency declarations with no identified owning import at capture.

## Root Cause Analysis

### Investigation Tasks

- [ ] Confirm whether either dependency satisfies an undocumented peer, test, build, or package-manager requirement.
- [ ] Create a clean-install reproduction that removes one declaration at a time.
- [ ] Run packed-package checks and the full suite after each candidate removal.
- [ ] Remove a dependency only when the evidence shows no owned purpose; otherwise document and test that purpose.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- Standing risk: [R007: Release Pipeline Publishes the Wrong or Compromised Package](../../risks/R007-release-pipeline-publishes-the-wrong-or-compromised-package.active.md).
- Architecture review found the R007 mapping accurate and required this ticket to describe necessity as unverified until clean-install and full-suite evidence exists.
- Duplicate-check review found more than five existing release and package problems that may be related. Leave parent or duplicate decisions to the next `/wr-itil:review-problems` pass: Problems 001, 002, 003, 005, 008, 009, 010, and 011.
- Captured via `/wr-itil:capture-problem`.
