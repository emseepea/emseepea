# Current Release Readiness

Date: 2026-09-30

This review covers the opt-in one-way Markdown feedback destination and its
website guide. The previous package release has been verified and merged back
to `main`. This is the next release plan, not a publication claim.

## Planned Package Set

- `@emseepea/feedback@0.5.0`

The private website workspace is also planned for version 0.0.2 so the checked
website guide deploys with this release. It is not an npm package. The package
list above names only the public package that the registry gate will verify.

## Source Evidence and Limits

The backend writes private, scope-separated Markdown files and returns a
receipt only after syncing the file and its directory entry. A repository-local
`docs/feedback` folder is supported for dogfood testing: the adapter creates
and verifies an ignore rule before writing feedback. The guide states that
already tracked, staged, or force-added files are outside that protection. The
adapter provides no team reply path or shared storage across instances.

`npm ci --ignore-scripts` and the complete `npm test` passed in the isolated
integration checkout after reconciliation with current `main`. The local
benchmark build passed. Its first measurement attempt hit a transient local
loopback bind error; the exact built benchmark suite passed on retry. A first
full-suite run under competing work hit a short timeout in an unchanged
feedback test; the final complete run passed. These are local checks, not
exact-commit Quality, release, registry, or deployed-site evidence.

Independent architecture and Jobs To Be Done reviews passed for the revised
repository-local design. Cognitive-accessibility review passed for the package
guide, website guide, and release note. Cumulative commit, push, and release
risk scored 5/25, within the configured 5/25 appetite. Exact-commit gates
remain required.

## Required Publication Evidence

- Qualify the exact committed source and pass Quality on the exact `main` push.
- Confirm that the release pull request contains only the planned public
  feedback package and the private website version change.
- Pass Release checks and publish the feedback package under `next` from the
  exact checked release head.
- Verify registry version, integrity, signatures, provenance, public types,
  and clean installation against the published tarball.
- Promote only the verified tarball to `latest`, deploy the measured website
  artifact, tag the package, and merge the publish head back to `main`.
- Read back the exact source and registry state before claiming publication.

## Review Status, Not Release Status

The labels below are read by release tooling. They describe conditional
readiness; they do not assert that publication or website deployment occurred.

- Result: PASS
- Risk review: PASS within the accepted 5/25 risk threshold.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.
