# Current Release Readiness

Date: 2026-09-20

Release verification is not complete. This review covers publishing first-party
tool result schemas open, and the dependency-closed releases that go with it:

- `@emseepea/server@0.16.0`
- `@emseepea/feedback@0.3.0`
- `@emseepea/react@0.3.4`
- `@emseepea/svelte@0.1.8`
- `@emseepea/testing@0.16.2`
- `@emseepea/create-api-backed-server@0.0.41`
- `@emseepea/create-database-schema-server@0.0.28`
- `@emseepea/create-html-ui-server@0.0.43`
- `@emseepea/create-mongodb-backed-server@0.0.28`
- `@emseepea/create-multi-instance-postgres-server@0.0.31`
- `@emseepea/create-openapi-backed-server@0.0.23`
- `@emseepea/create-progress-streaming-server@0.0.41`
- `@emseepea/create-react-ui-server@0.0.43`
- `@emseepea/create-resources-and-prompts-server@0.0.40`
- `@emseepea/create-soap-backed-server@0.0.28`
- `@emseepea/create-tool-server@0.0.43`

## Who Wrote This and What It Is Worth

An agent wrote this record, and an agent wrote the change it describes and the
release notes that ship with it. Read it as that agent's account of its own
work, not as someone else's check on it.

Three reviews ran separately from the agent that did the work, each with its own
context. They are also agents, not people.

- Architecture review ran three times and failed the change twice. The first
  failure was substantive: an earlier draft had no release notes at all for a
  change to a published contract. The second was a defect the agent had shipped
  into the working tree — a test asserting the old behaviour, which the agent
  had not run before reporting the change as green.
- Cognitive-accessibility review ran over the release notes four times, and
  separately over this record and the backlog records written today. Its
  findings are in `docs/reviews/cognitive-accessibility-2026-09-20.md`. On the
  release notes it found a heading reading "What did not change" sitting above a
  paragraph describing a change, and a disclosure that gave the reader no
  remedy; both were fixed. On earlier records that file lists findings that were
  not applied, and says which and why.
- Risk review scored the change above this project's appetite and refused it
  until the release notes said something falsifiable about whether this would
  happen again.

## Open Result Schemas in First-Party Tools

The tools shipped in the feedback package, and the result view exported from the
server package, declared their results closed. A client validating a response
against a captured copy of one of those schemas had to reject any field the
result gained later, so adding a field was a breaking change for that client.
Those schemas are now open.

The mechanism this project shipped in 0.15.0 is unchanged. A schema declared
strict still publishes closed, and that is still how to ask for a closed
contract deliberately. What changed is which declaration these particular
first-party schemas use.

Result values do not change. The framework sends the value its schema produced,
so a field the schema does not declare is removed before the response is built,
exactly as before.

## Evidence So Far

- Both new checks were watched failing first. The feedback check reported closed
  nodes at the result root and inside the messages array; the result-view check,
  with the change temporarily reverted, named every closed node in the view.
  Both pass with the change in place.
- A test that asserted the old behaviour was found failing and corrected rather
  than deleted. It now asserts that an undeclared key is dropped, at the top
  level and nested, which keeps the property that matters: a key nobody declared
  never reaches the view a renderer receives.
- Architecture review read the code and found that nothing undeclared can reach
  a client that could not before, and that this change does not alter how a
  deliberate closed declaration is treated. That is not a claim that every
  deliberate closed declaration publishes closed. It does not — see the limit
  below.
- Risk review examined whether opening the result view weakens the boundary that
  parses messages arriving by `postMessage`. It concluded the boundary never
  rested on rejecting unknown keys; it rests on a sender check and on per-field
  validation, both unchanged.
- The full local test command stopped at the checks that need Docker. The
  checks that do not need it were run separately and passed. See the limits
  below.

These are checks on the source code and on this machine. They do not prove that
continuous integration passed on the exact commit, that npm accepted the
packages, what the registry now serves, or that any adopter runs this.

## Known Limits of This Review

- Docker was not running on this machine, so the container-backed example
  projects and two packed-initializer checks did not run locally. Everything
  else ran: the decision check, lint, build, typecheck, and the feedback, React,
  Svelte, testing and Tailwind package suites. The black-box, documentation and
  language-model suites ran 233 tests: 231 passed and 2 were skipped.
  Continuous integration runs the full suite on the exact commit, and that run
  is the evidence for this release rather than the local one.
- This is the second release in a row to change published result schemas from
  closed to open, so adopters re-capture their stored schema copies twice. The
  0.15.0 note told them schemas declared strict were unaffected. That was true
  of the rule and not of these schemas, which were declared that way. Both
  release notes say so directly and name the tests that now enforce openness, so
  the claim can be checked rather than believed.
- An adapter's mistake is quieter than it was. An unexpected key nested inside a
  feedback conversation is now dropped rather than reported. It is still never
  sent to a client. Both the source and the release note record this.
- The release plan omitted the eleven starter packages that pin the server
  version. The release-readiness check caught it and the starters were added.
  That omission is Problem 001, which remains open; this release worked around
  it by hand rather than fixing it.
- A deliberately strict result schema does not always publish closed. When it is
  fed from an open object, the framework drops the closure and publishes the
  schema open. That behaviour arrived in 0.15.0 and this release does not fix
  it. It is Problem 006, which remains open. Both release notes in this release
  now disclose it, because the alternative was to repeat the mistake this
  release exists to own.
- A guide check does not exist, so nobody verified the shipped package guide
  against this change. Problem 007 is the permanent record and this release
  widens it: the guide is now also silent on the result view publishing open.

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

The result below is the source-readiness result.

- Result: PASS
- Source-readiness review: PASS
- Pipeline risk review: commit, push, and release are each within the approved
  risk limit of 5 out of 25. The first score was above that limit and refused
  the release until the notes said something a reader could check.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
