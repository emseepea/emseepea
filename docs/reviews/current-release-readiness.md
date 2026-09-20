# Current Release Readiness

Date: 2026-09-20

Release verification is not complete. This review covers publishing tool result
schemas open by default, and the dependency-closed releases that go with it:

- `@emseepea/server@0.15.0`
- `@emseepea/feedback@0.2.17`
- `@emseepea/react@0.3.3`
- `@emseepea/svelte@0.1.7`
- `@emseepea/testing@0.16.1`
- `@emseepea/create-api-backed-server@0.0.40`
- `@emseepea/create-database-schema-server@0.0.27`
- `@emseepea/create-html-ui-server@0.0.42`
- `@emseepea/create-mongodb-backed-server@0.0.27`
- `@emseepea/create-multi-instance-postgres-server@0.0.30`
- `@emseepea/create-openapi-backed-server@0.0.22`
- `@emseepea/create-progress-streaming-server@0.0.40`
- `@emseepea/create-react-ui-server@0.0.42`
- `@emseepea/create-resources-and-prompts-server@0.0.39`
- `@emseepea/create-soap-backed-server@0.0.27`
- `@emseepea/create-tool-server@0.0.42`

## Who Wrote This and What It Is Worth

An agent wrote this record, and an agent wrote the change it describes and the
release note that ships with it. Read it as that agent's account of its own
work, not as someone else's check on it.

Four reviews ran separately from the agent that did the work. Each had its own
context and reached the artefacts on its own. They are also agents, not people.
Where they left a dated record you can read it yourself:

- Pipeline risk review, in `.risk-reports/2026-09-19T10-27-50-commit.md` and
  `.risk-reports/2026-09-19T20-58-55-commit.md`. Those two cover this release
  surface. The other entries in that directory score documentation-only changes
  and do not.
- Cognitive-accessibility review, in
  `docs/reviews/cognitive-accessibility-2026-09-19.md`, covering the release
  note and ADR-0096, and in
  `docs/reviews/cognitive-accessibility-2026-09-20.md`, which covers this
  record and the two problem records named below. The 2026-09-20 review
  returned findings on this record that were not applied; the limits section
  says how many and why.
- Architecture review and Jobs To Be Done review left no file. Their findings
  survive only in this record and in the changes they caused, which is weaker
  evidence than the two above.

Those reviews are worth something concrete: between them they rejected a draft
that would have rebuilt each schema document on a per-request path, predicted a
defect that was then reproduced through the real endpoint, and caught a
correction this agent had reported as applied when it had not been. They are not
human review.

## Open Result Schemas by Default

A tool result declared with an ordinary object schema published a closed
contract, so a client validating against a captured older copy of that schema
rejected any field added later. The published schema now permits unknown fields.

The framework converts each result schema in both directions and drops the
closure only where the matching input node is itself an object node that stays
open. A deliberately strict declaration closes both directions and keeps its
closed contract. A node with no matching counterpart, or one of a different
kind, keeps its closure, so a node that cannot be checked stays closed rather
than opening.

Result values do not change. A handler still cannot return a key its result
schema does not declare, and a response still carries only declared fields.

This release is a migration. Every stored contract baseline reports breaks once,
and adopters re-capture their baselines after upgrading.

## Evidence So Far

Each line below says who did something and what it showed.

- A person ratified the decision behind this change before anyone implemented
  it. The decision record landed in commit `dad55407`. The implementation
  followed in commit `0b6b5ae5`.
- An architecture reviewer passed the change after several rounds. It rejected
  an earlier draft that rebuilt each result schema document every time the
  server was asked for its tool list. The server now builds each document once,
  when it registers the tool.
- A Jobs To Be Done reviewer passed the change against the job of evolving a
  published contract safely. Jobs To Be Done records describe what a person is
  trying to accomplish; this project keeps them under `docs/jtbd/`.
- A regression test covers the change through the real server boundary. It was
  written first and watched fail, then the change made it pass. Watching it fail
  first is what proves the test can catch the defect at all.
- A second test covers a defect the risk reviewer predicted. A strict result
  schema sitting behind a transform was compared against an input of a different
  kind, and the framework dropped its closure. The test fails without the fix
  and passes with it.
- The risk reviewer scored this work at 5 for committing, 3 for pushing, and 0
  for releasing. The scale runs to 25 and lower is better. This project accepts
  up to 5.
- The release note passed four rounds of cognitive-accessibility review. Every
  finding was applied.
- The one-time break is recorded as a migration that adopters act on, rather
  than absorbed quietly. Adopters re-capture their stored schema copies once.

These are checks on the source code and on this machine. They do not prove any
of the following: that continuous integration passed on the exact commit, that
npm accepted the packages, what the registry now serves, where the packages were
built, that a fresh install works, or that any adopter runs this in production.

## Known Limits of This Review

The first limit is about how this release was checked. The rest are about the
software itself or about the process, and each says where it is recorded
permanently.

- The full local test command did not finish. Docker was not running on this
  machine, so the example server that needs a PostgreSQL database could not
  start one. Continuous integration ran the full suite instead: Quality run
  `35478489686`, against source commit `a786354c`, and it passed. Treat that run
  as the evidence for this release. The local run is not evidence.
- The check that reports an added result field has stopped reporting for schemas
  written the ordinary way. This release is what makes the ordinary way open, so
  this is now the common case rather than an edge case. That weakens something
  the contract-stability job asks for: that incompatible changes to result
  schemas get caught and fail a check automatically. ADR-0096, the decision
  record for this change, accepts that cost and is the permanent record of it.
- One defect ships without a fix. If an author writes a strict result schema fed
  from an open object, the framework drops the closure the author asked for, and
  the published schema tells clients to accept fields the server will never
  send. Problem record P006 is the permanent record. The release note states the
  limit.
- Nobody checked the guidance against this change, because no such check exists
  in the release process. The guide shipped inside `@emseepea/server` still
  describes the old behaviour: it does not mention the new default or how to ask
  for a closed contract. Problem record P007 is the permanent record.
- This record and the two problem records ship with cognitive-accessibility
  findings nobody applied: 27 on this record and 18 across the two problem
  records. They are about how readable the documents are, not whether they are
  correct. The maintainer directed that the release proceed rather than absorb
  another review cycle. `docs/reviews/cognitive-accessibility-2026-09-20.md`
  records what was found and why it was left.

## Current Base Boundary

Release pull request `116` merged as
`a786354c`. Quality run `35478489686` passed for that base. This evidence does
not cover the planned release.

## Required Publication Evidence

- The Quality workflow must pass on the exact source commit.
- The Changesets release pull request must contain only generated version,
  lockfile, manifest, and changelog changes for the exact package set above.
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
