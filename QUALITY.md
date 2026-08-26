# Quality Policy

Em See Pea qualifies claims from a clean checkout at the public boundary. A
green proxy check is not evidence for an untested claim.

## Required Quality Sequence

1. Install exactly from the committed lockfile with `npm ci --ignore-scripts`.
2. Type-check source, test drivers, and repository scripts.
3. Build all workspaces from current source.
4. Run raw HTTP and independent-client tests against the real endpoint.
5. Check any published schema or generated public artifact against its declared
   contract.
6. Run `npm audit --audit-level=high`.

Every step runs on Node.js 22 and 24 from a GitHub-hosted clean checkout. A
failure stops the job; later steps are not evidence for earlier ones.

## Test Rules

- Assert the exact capability and deployment boundary being claimed.
- Delete generated output before tests that consume build artifacts, preventing
  stale files from producing false results.
- Invalid or rejected requests must prove zero handler and backend calls.
- Keep tests outside production packages, but include their JavaScript and
  TypeScript in runnable or static quality checks.
- Add a contract check only when a public artifact exists; do not create a
  baseline for a future surface.
- UI examples must test both light and dark color pairs, keyboard operation,
  accessible names, focus visibility, status announcements, and WCAG 2.2 AA.

## Automation Rules

- Keep quality and release workflows separate.
- Pin third-party GitHub Actions to immutable commit SHAs and document the
  corresponding release tag in a comment.
- Use least-privilege workflow permissions, timeouts, and concurrency controls.
- Changesets may create or update a release pull request, but no workflow may
  publish to npm until a later reviewed decision enables it.
- Do not add deployment, production attestation, signing, or environment
  verification workflows to this framework repository.

## Evidence and Claims

A capability claim may be added only when the committed clean-checkout job
passes the exact public-boundary checks for that claim. Failure or drift
withdraws the claim until a later green revision restores it.

The process precedents and their clean-room limits are recorded in the
[source provenance log](docs/provenance.md).
