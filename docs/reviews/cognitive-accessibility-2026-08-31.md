# Cognitive-Accessibility Review 2026-08-31

Reviewer: independent cognitive-accessibility specialist.

## ADR-0030 Ratification

Reviewed files:

- `docs/decisions/0030-public-post-progress-behind-a-trusted-proxy.proposed.md`
- `docs/decisions/README.md` (ADR-0002 and ADR-0030 sections)
- `docs/decisions/0002-anonymous-production-boundary.superseded.md`

The historical decision was moved from
`docs/decisions/0002-anonymous-production-boundary.proposed.md` without changing
its content.

Result: PASS. ADR-0030 describes the allowed deployment behavior separately
from the tests required before implementation is qualified. Short sections
separate benefits, limits, and checks. The generated index records ratification
and supersession, not feature completion.

This was a source-level Markdown review, not a rendered mobile-browser test.
The specialist also reviewed this evidence wording.

## Public Proxy Progress

Result: PASS. Reviewed `.changeset/tidy-pods-progress.md` and pull-request
wording. The text describes what developers can enable and separates it from
features not included. Load qualification remains a CI requirement, not a local
result.

## Proxy Progress Guides

Reviewed files:

- `README.md`
- `packages/framework/README.md`
- `examples/streaming-progress/README.md`
- `docs/protocol-coverage.md`
- `BATTLE-PLAN.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md`

Result: PASS. The guides explain how developers can enable progress on public
tools and distinguish source availability from npm publication. Configuration,
proxy responsibilities, and unsupported features are separate short sections.
CI details stay in the coverage ledger.

This was a source-level Markdown review, not a rendered mobile-browser test.

Also reviewed the generated release-evidence wording in
`.github/workflows/release.yml`. Result: PASS. It records the new load check and
separates public progress from streaming features not included.

## Request Telemetry

Reviewed files:

- `packages/framework/README.md`
- `docs/protocol-coverage.md`
- `.changeset/quiet-pods-telemetry.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md`

Result: PASS. The guide separates setup, measurements, privacy, and current
limits. It distinguishes source availability from npm publication and transport
completion from tool success.

This was a source-level Markdown review, not a rendered mobile-browser test.

## Readiness and Shutdown

Reviewed files:

- `packages/framework/README.md`
- `docs/protocol-coverage.md`
- `.changeset/calm-pods-shutdown.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md`

Result: PASS. The guide separates dependency status from tool access and
explains both shutdown time limits. It makes the callback cancellation and
delivery limits explicit.

This was a source-level Markdown review, not a rendered mobile-browser test.

## Code-First AI Understanding Tests

Reviewed files:

- `README.md`
- `QUALITY.md`
- `BATTLE-PLAN.md`
- `packages/testing/README.md`
- `tests/llm/README.md`
- `examples/basic-no-ui/README.md`
- `examples/backend-no-ui/README.md`
- `examples/protected-no-ui/README.md`
- `examples/resources-prompts/README.md`
- `examples/multi-instance/README.md`
- `examples/streaming-progress/README.md`
- `examples/native-ui/README.md`
- `examples/react-tailwind-ui/README.md`
- `docs/risks/R005-semantic-qualification-misses-wrong-meaning.active.md`
- `docs/jtbd/mcp-server-developer/JTBD-003-prove-an-ai-understands-the-result.proposed.md`
- `.changeset/plain-peas-evals.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md`

Result: PASS. Reviewed changed guides and examples. Separate commands and
directories, model prerequisites, and limitations are stated plainly. Real
model checks are distinguished from simulated-model smoke tests.

This was a source Markdown review, not rendered browser verification.

## Next Release Review

Reviewed files:

- `docs/reviews/0.0.3-release-readiness.md`
- `.github/workflows/release.yml` (generated release-evidence prose)
- `packages/framework/CHANGELOG.md` (planned 0.0.3 section)
- `packages/testing/CHANGELOG.md` (planned 0.1.0 section)
- `docs/reviews/cognitive-accessibility-2026-08-31.md` (this section)

The changelog review used release-PR revision
`31bc390d76d0e0006773695d16bc87090742e9ac`.

Result: PASS. The record separates reviewed source, pending publication checks,
and completed publication. The generated evidence describes the supported HTTP
client without claiming general outbound-call support. The release notes
explain the JavaScript migration and remaining limits.

This was a source-text review, not rendered browser verification. Release
qualification remains pending.

### Historical Decisions

Reviewed unchanged historical files:

- `docs/decisions/0024-subscription-backed-claude-semantic-release-checks.superseded.md`
- `docs/decisions/0026-example-owned-quality-assurance-surfaces.superseded.md`
- `docs/decisions/0027-public-semantic-testing-package.superseded.md`

Result: QUALIFIED PASS. These preserve historical Promptfoo and YAML wording.
They are superseded records, not current setup instructions; the decisions
index identifies their replacement. ADR-0029 was not part of this review.

### Code-First Decision Alignment

Reviewed files:

- `docs/decisions/0029-code-first-semantic-tests.proposed.md`
- `docs/decisions/README.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md`

Result: PASS. The decision now matches the examples: ordinary tests live in
`test/`, and LLM tests live in `eval/`. The owner-approved in-place update is
recorded. The decision preserves model isolation, three answers, and nine
judgments.

This was a source Markdown review, not rendered browser verification.

## Website Decision Split

Reviewed files:

- `docs/decisions/0025-static-documentation-website-with-astro-starlight.proposed.md`
- `docs/decisions/0031-website-workspace-in-the-existing-monorepo.proposed.md`
- `docs/decisions/0032-static-only-website-runtime.proposed.md`
- `docs/decisions/0033-github-pages-website-hosting.proposed.md`
- `docs/decisions/0034-one-source-for-reader-guides.proposed.md`
- `docs/decisions/0035-verified-guides-before-website-publication.proposed.md`
- `docs/decisions/0036-one-current-documentation-set.proposed.md`
- `docs/decisions/0037-local-website-search.proposed.md`
- `docs/decisions/0038-measured-website-performance-before-publication.proposed.md`
- `docs/decisions/README.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md` (this section)

Result: PASS. Each record states one website decision. The workspace record
explains that this is the only Em See Pea website in the existing public MIT
monorepo. The records distinguish approved design from a deployed website and
from the numerical performance budget still to be agreed.

Source-level Markdown and cognitive-accessibility review only; no website has
been built or browser-tested by this review. The specialist also reviewed this
evidence wording.

## Fresh-Install Release Checks

Reviewed files:

- `docs/risks/R007-release-pipeline-publishes-the-wrong-or-compromised-package.active.md`
- `docs/reviews/cognitive-accessibility-2026-08-31.md` (this section)

Result: PASS. The risk record distinguishes npm publication from a completed
GitHub release. It explains what the fresh-install checks do and when they run.
The six dependency findings are attributed to the historical run, not the
current package.

This was a source Markdown review, not rendered browser verification.
