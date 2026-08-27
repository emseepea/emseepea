# Quality Policy

Em See Pea qualifies claims from a clean checkout at the public boundary. A
green proxy check is not evidence for an untested claim.

## Required Quality Sequence

1. Install exactly from the committed lockfile with `npm ci --ignore-scripts`.
2. Type-check and build all workspaces from current source.
3. Type-check test drivers and public type contracts against that fresh output.
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
- Public discovery and public tools must prove that bearer headers neither
  invoke the verifier nor create an authenticated handler context.
- Public resources and prompts must prove that listing and invocation remain
  verifier-free and identity-free, including when OAuth is configured.
- Public resource templates must additionally prove exact catalogue metadata,
  URI-variable extraction, matching reads, and zero calls for unmatched or
  malformed URIs.
- Unknown static resource URIs and invalid prompt arguments must prove zero
  application-handler calls.
- Protected calls must prove failure before handler execution for missing,
  invalid, expired, insufficient-scope, wrong-resource, and timed-out
  verification outcomes.
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
- Changesets creates or updates the release pull request. Only
  `@emseepea/server` may publish under `next`, after required pull-request checks
  and exact merged-commit qualification pass. The root and examples remain
  private.
- Routine publication uses npm trusted publishing, automatic provenance,
  checksum and SBOM evidence, and no durable npm write token.
- Do not add deployment, production attestation, signing, or environment
  verification workflows to this framework repository.

## Evidence and Claims

A capability claim may be added only when the committed clean-checkout job
passes the exact public-boundary checks for that claim. Failure or drift
withdraws the claim until a later green revision restores it.

Dependencies, licences, and release evidence use the repository manifests,
lockfile, reviews, checksums, software bills of materials, and npm provenance.
