# Current Release Readiness

Date: 2026-09-08

## Release Batch

- `@emseepea/create-multi-instance-postgres-server@0.0.3`

## Change for Users

The multi-instance PostgreSQL initializer now presents interchangeable server
processes instead of exposing routing details. Its save and get tools identify
reports by garden bed and harvest date. Generic retry keys, server names, and
storage identifiers have been removed from the public MCP contract.

## Evidence Before Publication

- TypeScript compilation and lint passed locally.
- Architecture review passed and the ratified design is recorded in ADR-0058.
- Type checking, decision checks, the package-list check, and the executable
  quickstart passed locally.
- Jobs To Be Done, cognitive-accessibility, and Markdown accessibility reviews
  passed.
- Local PostgreSQL checks received no credit because Docker Desktop did not
  respond. Exact-commit CI must supply the PostgreSQL, standalone initializer,
  and semantic evidence before publication.
- Commit, push, and release risk are each 5 of 25 and within appetite because
  publication remains structurally blocked until those exact gates pass.

## Required Publication Evidence

- Exact-commit Quality must pass Node.js 22 and 24, OSV, website, package, and
  standalone initializer checks.
- The later release job must pass every provider-native semantic example before
  publication.
- npm publication must use Trusted Publishing and expose provenance, registry
  metadata, a clean install, and package evidence.

## Review Status

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
