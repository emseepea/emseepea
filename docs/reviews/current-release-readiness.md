# Current Release Readiness

Date: 2026-09-21

Release verification is not complete. This review covers two changes to the
`production-behind-proxy` deployment profile — reading the forwarded client
address by counting from the end, and proving a proxy that has no stable
address with a secret header — and the dependency-closed releases that go with
them:

- `@emseepea/server@0.17.0`
- `@emseepea/feedback@0.3.1`
- `@emseepea/react@0.3.5`
- `@emseepea/svelte@0.1.9`
- `@emseepea/testing@0.16.3`
- `@emseepea/create-api-backed-server@0.0.42`
- `@emseepea/create-database-schema-server@0.0.29`
- `@emseepea/create-html-ui-server@0.0.44`
- `@emseepea/create-mongodb-backed-server@0.0.29`
- `@emseepea/create-multi-instance-postgres-server@0.0.32`
- `@emseepea/create-openapi-backed-server@0.0.24`
- `@emseepea/create-progress-streaming-server@0.0.42`
- `@emseepea/create-react-ui-server@0.0.44`
- `@emseepea/create-resources-and-prompts-server@0.0.41`
- `@emseepea/create-soap-backed-server@0.0.29`
- `@emseepea/create-tool-server@0.0.44`

## Who Wrote This and What It Is Worth

An agent wrote this record, and agents wrote the change it describes and the
release notes that ship with it. Read it as those agents' account of their own
work, not as someone else's check on it.

The implementation and its first tests came from a different session, working
in a separate worktree, which had reported the issue and then measured its
cause in a live deployment. The session writing this record added three tests,
the prose, and the decision record.

Three reviews ran separately from the agents that did the work, each with its
own context. They are also agents, not people.

- Architecture review ran three times. The first run passed. The second
  failed the change. Its ground was that the decision record this change
  implements had been ratified and was then edited in place, which this
  project's own rule forbids. The third run passed, but only because it was
  told the maintainer had directed the rewrite. The underlying conflict was
  not fixed. It is written down below as a known limit.
- Cognitive-accessibility review graded three of five changed prose surfaces
  as failures, all on the same point. A sixth surface, the starter-package
  changeset, was written afterwards and reviewed separately; it carried the
  same defect a seventh time. Both rounds of findings, and the exact text each
  cleared, are in `docs/reviews/cognitive-accessibility-2026-09-21.md`.
- Risk review ran repeatedly, and its sequence matters more than any single
  number. An early score was within appetite. The push was then refused by
  the release-readiness gate, which forced the starter changeset and this
  record's rewrite, so that score no longer described the tree. A later score
  refused the commit: it found this record citing the earlier score as though
  it still applied. That citation is what this bullet replaced. This document
  states the band rather than a value, because a value copied here goes stale
  the moment anything else in the tree changes, and because the run that
  confirms a value always postdates the record describing it. The full
  reports are local artefacts under `.risk-reports/`, which is not committed,
  so a reader of this repository cannot open them.

## Proving a Proxy With No Fixed Address

A server behind a load balancer with no stable address could not start at all.
The profile required a list of literal proxy addresses, and platforms like
Cloud Run behind an external load balancer present nothing stable to list.

The profile now takes `proxyBoundary`: a header name and a secret. The adopter
configures the proxy to inject that header, and the server refuses any request
that does not carry it. Exactly one of the two fields is supplied.

An earlier form of this change was withdrawn before it shipped. It let the
deployment declare that the platform enforced the boundary, which the
framework had no way to check. Pipeline risk review scored it above appetite
and refused the commit, on the grounds that every remaining check is settable
by whoever sends the request, so the address comparison was the only one
binding to network position. The replacement inverts the failure direction: a
proxy that is not sending the header refuses every request, so a mistake
closes the server rather than opening it. ADR-0103 records that decision and
supersedes ADR-0102.

## Reading an Appending Proxy

A server in `production-behind-proxy` mode refused every request that arrived
through a load balancer which appends its own address to `x-forwarded-for`
rather than replacing the header. The check accepted one entry and nothing
else, and an appending balancer always produces at least two, so such a
deployment could not start serving at all.

The production profile now takes an optional `forwardedHops`: how many entries
the proxies in front append after the client address. One hop is one piece of
infrastructure that adds its own address to the header.

The server counts back that many positions from the end of the header and
treats the entry it lands on as the client. While that count matches the
deployment, anything a caller puts in front of the client address is ignored.
If the count is set higher than the truth, the server lands inside the part of
the header the caller controls. Nothing in the framework detects that.

The default is `0`, which is exactly the previous rule. No existing
configuration becomes invalid, and no address allowlist widens.

## Evidence So Far

- The cause was measured, not guessed at. The reporting session deployed
  instrumentation to the affected service and read three requests. Every one
  showed two forwarded-for entries, the protocol present exactly once and
  always `https`, no duplicated field, and a peer matching the configured
  trusted proxy. Three requests from one service is a small sample. For those
  requests it rules out every other cause of the refusal message the code can
  produce, which leaves the case where the header carries more than one entry.
  That is strong evidence, not proof that no other cause exists anywhere.
- The dangerous failure direction is pinned by a behavioural test, not by
  prose. One real appending hop declared as two: a caller who prepends is
  served on a rate-limit budget of their own, so the limit never catches them.
  Two differing prefixes each get a fresh budget, and repeating a prefix
  returns 429 Too Many Requests, which shows the limiter is still limiting
  rather than disabled.
- A paired test shows the opposite case: when the count is right, a caller
  cannot get a rate-limit budget of their own. A budget of one request, two
  requests differing only in the prefix the caller supplied, second refused.
- A test covers the repeated-header trick: sending `x-forwarded-for` twice
  cannot move which entry the server reads. It runs at hop counts 0 and 1,
  which are the counts this release's deployments use, not at arbitrary counts.
- A check in the opposite direction shows the default did not widen: the same
  two-entry header the new tests accept at hop 1 is refused at the default.
- The hop-count mismatch is recorded through the operator's observability
  adapter. The test checks that the refusal sent back to the caller mentions
  hops nowhere, in any capitalisation. It checks the one refusal path the test
  exercises, not every response the server can send.
- The proved boundary is checked, not declared. Its tests cover a served
  request from an unlisted peer, and refusal when the header is absent, empty,
  wrong, a prefix of the secret, an extension of it, or sent twice. A further
  test asserts the secret reaches no observability adapter on either path.
- A secret that could never match is refused at construction rather than at
  every request: shorter than 32 characters, outside printable ASCII, or with
  surrounding spaces. The encoding case matters because a header value is
  decoded latin1 while the configured string hashes as UTF-8.
- Local runs: 232 of 233 black-box and documentation tests pass. The one
  failure is the packed-initializer check, named under limits below. Typecheck
  clean, decision check clean, published-content and README density gates pass.

These are checks on the source code and on this machine. They do not prove that
continuous integration passed on the exact commit, that npm accepted the
packages, what the registry now serves, or that any adopter runs this.

## Known Limits of This Review

- The measured benchmark that architecture decision record 0102 (ADR-0102)
  requires before release did not run on this machine. It fails on this host
  with `EADDRNOTAVAIL`, which means the host would not give it a network
  address to listen on. The Quality workflow is configured to run it on the
  exact commit, and the release pull request depends on that job. This review
  did not watch that job run, so there is no local evidence for the benchmark
  at all.
- One test failed locally: the packed-initializer check that scaffolds
  `create-multi-instance-postgres-server` and runs its suite. PostgreSQL is not
  running on this machine. Continuous integration runs it under initializer
  qualification, which the release pull request also depends on.
- The secret travels as a request header, so the adopter's own proxy or CDN
  may log it. The framework does not log the value and does not send it to an
  observability adapter, and both are tested; neither fact constrains the
  infrastructure in front, where header logging is a common default. Every
  adopter-facing surface now says so. This is the real cost of moving from a
  network-position check to a bearer secret.
- There is one secret, with no second value accepted during rotation, so
  rotating it has a window in which requests are refused. ADR-0103 records
  that as an accepted limitation rather than an oversight.
- ADR-0103 is not yet ratified and ADR-0102 has not been renamed to superseded.
  Both change together when the maintainer ratifies. Until then the generated
  decision index lists ADR-0102 among current decisions, and its checks
  describe a shape the code no longer has.
- ADR-0102 was rewritten in place after it was ratified, four times.
  The maintainer directed each rewrite and re-ratified it each time. This
  project's rule is that a ratified decision is superseded, not amended. That
  rule is the reason three supersession records were written yesterday.
  Architecture review flagged the conflict correctly. There is an unwritten
  exception here, that the maintainer may direct a rewrite in place, and
  because it is unwritten the rule and the practice disagree. No problem
  ticket has been filed for this yet; it is queued as a session task only.
- The eleven starter packages that pin the server version were again omitted
  from the release plan, and again caught by the release-readiness check rather
  than by the author. That is Problem 001, which remains open. This release
  worked around it by hand, exactly as the previous release did.
- GitHub issue 120 is not closed by this release. The cause was measured, and
  the fix behaves as intended in every case the tests cover. That is not the
  same as verified in production. Verifying it needs a release, and then a real
  request through the affected deployment that actually succeeds.

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
- Source-readiness review: PASS. This is a result about the source code only.
  It is not a release result.
- Pipeline risk review: each layer is within the approved risk limit of 5 out
  of 25, as scored for the exact commit this record ships with. The score
  itself is not restated here; see the note under "Who Wrote This and What It
  Is Worth" for why.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE until the required publication gates pass.
