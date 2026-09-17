# Current Release Readiness

Date: 2026-09-18

Release verification is not complete. This review covers one planned package:

- `@emseepea/testing@0.15.0`

## Published Contract Command

`emseepea-contract` captures a version-labelled public MCP contract from an
explicit application factory or MCP URL. Its check mode discovers every JSON
baseline in an explicit directory and delegates compatibility semantics and
diagnostics to the existing published-contract API.

Protected discovery reads a bearer token only from the environment variable
named by `--token-env`. The command does not accept token values as arguments.
Tests verify that token values do not appear in command output or baseline
files. Capture, compatibility failure, and command failure use exit statuses
0, 1, and 2 respectively.

Applications continue to own normalization, legacy migration, stricter rules,
baseline retention, approvals, capture timing, and deployment policy.

## Evidence So Far

- The architecture review found no new decision. The command orchestrates the
  existing extractor, baseline writer, and compatibility assertion within the
  established public testing package.
- The Jobs To Be Done review confirmed alignment with JTBD-006, Evolve a
  Published MCP Contract Safely. No new job is required.
- Focused Node.js 24 tests pass for application-factory capture, protected MCP
  URL capture, environment-only authentication, baseline discovery, concrete
  diagnostics, token exclusion, and exit behavior.
- Existing published-contract API tests pass without changed comparison
  semantics.
- Package build, lint, documentation evidence checks, and an npm package dry
  run pass. The packed file list contains the executable command.
- Independent cognitive-accessibility review passed for the package guide and
  release note.
- Commit, push, and release risk are each within the approved limit of 5 out
  of 25.

These are source and local checks. They do not prove exact-commit continuous
integration, publication, registry state, provenance, downloaded-package
behavior, or adopter production use.

## Current Base Boundary

Release pull request `108` merged as
`27e012af79d2d9c6d447c5df76377f6ae4692dc3`. Quality run `35242365541` and
Release run `35243403489` passed for that base. This evidence does not cover the
planned release.

## Required Publication Evidence

- The Quality workflow must pass on the exact source commit.
- The Changesets release pull request must contain only generated version,
  lockfile, and changelog changes for `@emseepea/testing@0.15.0`.
- Quality and Release must pass on the exact version commit.
- Registry readback must confirm the version and `latest` tag, integrity,
  signature, provenance, and exact release-commit binding.
- The downloaded package must pass clean installation and verify the public
  command through its packed entry point.
- Adopter production use requires separate journey evidence.

## Evidence Boundaries

Exact-commit continuous integration proves only that the tested commit passed
its checks. Publication proves only that npm accepted a package version.
Registry readback proves what npm serves. Provenance proves the package's build
and source binding. Downloaded-package checks prove that a clean consumer can
install and use the registry artifact. Adopter production verification requires
its own direct evidence.

## Review Status, Not Release Status

This document records readiness. It does not claim publication, registry
verification, downloaded-package verification, or adopter production use.

- Result: PASS
- Source-readiness review: PASS
- Pipeline risk review: commit, push, and release are within the approved risk
  limit of 5 out of 25.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
