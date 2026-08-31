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

## Published Content Gate

Every changed public prose file must pass a specialist cognitive-accessibility
review before commit, push, release, or website publication.

This includes:

- root, package, and example READMEs
- documentation and website pages
- release notes and Changesets
- package descriptions
- contribution, security, support, and conduct guidance
- generated prose
- public issue, pull-request, discussion, and release text

Source code, protocol fixtures, machine data, and generated evidence are
excluded unless they present prose to readers.

The review checks whether readers can:

- identify the task and next action
- understand the language and necessary terms
- scan the content on mobile
- follow the structure without unnecessary memory load
- reach detailed evidence through descriptive links

Review evidence must name every checked file or public message, record PASS or
FAIL, and retain any required correction. Missing or failed review evidence
blocks publication. Generated prose follows the same rule as human-written
prose.

`npm test` rejects changed public Markdown that is not named in a cognitive-
accessibility review record under `docs/reviews/`.

The automated README density test is only a regression signal. Passing it does
not prove cognitive accessibility, readability, comprehension, or Web Content
Accessibility Guidelines (WCAG) conformance.

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
- Completion must be advertised and admitted only when at least one prompt
  argument or resource-template variable has an explicit completion handler.
- Completion tests must reject unknown definition keys, malformed requests,
  sparse or non-string candidate arrays, oversized full candidate sets, and
  oversized emitted results without leaking application errors.
- Completion tests must prove required and optional prompt arguments, the
  100-value protocol boundary, registered-string-only sibling context, timeout
  and disconnect cancellation, concurrent-request isolation, verifier-free
  public access, and official-client prompt and resource-template references.
- Protected calls must prove failure before handler execution for missing,
  invalid, expired, insufficient-scope, wrong-resource, and timed-out
  verification outcomes.
- Keep tests outside production packages, but include their JavaScript and
  TypeScript in runnable or static quality checks.
- Add a contract check only when a public artifact exists; do not create a
  baseline for a future surface.
- User interface examples must test both light and dark color pairs, keyboard
  operation, accessible names, focus visibility, status announcements, and
  Web Content Accessibility Guidelines (WCAG) 2.2 AA.
- Every example must have an executable language-model understanding case in
  `eval/`, separate from ordinary tests in `test/`. It requires three fresh
  answers and three independent judgments per answer, made without MCP
  tools, fixed critical facts, and evidence of the exact MCP operation. All
  three answers must pass.
- For every trial, the harness must execute the exact tool call, resource read,
  or prompt get through the official client and bind the operation and returned
  material to evidence. Model processes receive no MCP tools; the check measures
  whether the model understands returned data, not whether it chooses a tool.
- The understanding check never retries a wrong answer. An unknown provider,
  model, credential, path, judgment, timeout, configuration, or evidence result
  stops publication.
- Semantic retries are disabled. Provider-internal transport retries
  are reported as unobservable and remain bounded by the provider timeout.

## Automation Rules

- Keep quality and release workflows separate.
- Pin third-party GitHub Actions to immutable commit SHAs and document the
  corresponding release tag in a comment.
- Use least-privilege workflow permissions, timeouts, and concurrency controls.
- Keep the required language-model understanding check in a separate job with
  only `contents: read`. Never run it with credentials against untrusted fork
  code.
- Changesets creates or updates the release pull request. Only
  `@emseepea/server` and `@emseepea/testing` may publish under `next`.
  Required pull-request and language-model checks must pass for the merged
  commit. The root, examples, React package, and Tailwind package remain
  private.
- The release job must depend on passing language-model checks for the publishing
  SHA through pinned Claude CLI and `claude-sonnet-4-6`. It uses the Claude
  subscription OAuth secret, and redacted evidence is retained for exactly 14
  days.
- Routine publication uses npm trusted publishing without a long-lived npm
  write token. It records the source and build, a checksum, and a list of the
  package's included software dependencies.
- Do not add deployment, production attestation, signing, or environment
  verification workflows to this framework repository.

## Evidence and Claims

A capability claim may be added only when the committed clean-checkout job
passes the exact public-boundary checks for that claim. Failure or drift
withdraws the claim until a later green revision restores it.

Dependencies, licences, and release evidence use the repository manifests,
lockfile, reviews, checksums, software bills of materials, and npm provenance.
