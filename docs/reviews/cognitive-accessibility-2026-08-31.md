# Cognitive-Accessibility Review 2026-08-31

## Website Budget Proposal

Result: PASS. Reviewed the proposed website limits and the matching
decisions-index entry. The text distinguishes an unapproved proposal, observed
measurements, and future publication checks. It explains units, test conditions,
and measurement limits. Source-text review only; this does not approve the budget
or establish website publication readiness.

Reviewer: independent cognitive-accessibility specialist. The specialist also
reviewed this evidence wording.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `docs/decisions/0039-website-performance-budget.proposed.md` | `56ac8ea9a8831bbbc8d7a20a8e7a3e4ba63aa06f07666698d24285a22aa24054` |
| `docs/decisions/README.md` | `7857f8a286c94510bec4427d5a0863c098711bd16f3878a314b87e4e7e9df7ed` |

## Initial Website Guides

Result: PASS. Reviewed the five initial website guides and their README entry
points. The site offers separate paths for creating a server, testing an
existing server, and reducing maintained server code.

This review checks clarity of the source text; it does not establish browser
accessibility, working commands, or publication readiness. The independent
cognitive-accessibility specialist also reviewed this evidence wording.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `website/src/content/docs/index.md` | `9ac58526221cc62ea93d57c0fb77c3858a152d4b1a4b87aecebd6877381da94a` |
| `website/src/content/docs/getting-started.md` | `a3d398684a02886dac300f78a5cd79dcea017abe654b1d52834aea5a7ad52c3c` |
| `website/src/content/docs/examples.md` | `f5ac364737a957bf81d080fd2d9759cbacb93985271d10a22c8652d214c583b6` |
| `website/src/content/docs/ai-tests.md` | `aab08861a3215b71aebacbbf005d897f4f7a93487ea9eebd0cfe4b4110001542` |
| `website/src/content/docs/less-server-code.md` | `a40be236c5b1f5bc249855726e9710e14514c0d07e56432e07874013b68bca74` |
| `README.md` | `08b5e05b821628a9d8f0fde7b3cd916627e34b1132fbb30b5a67c1f2be34083e` |
| `packages/testing/README.md` | `01ab71ec2913ee4e7329030e784256724730bb869624e7e9674317b4933c3504` |
| `docs/guides/getting-started.md` | `ce11c542e70fd7fa9494478575f3cb0df37e54ee62b46d2bb6b4c19866cffe6b` |

Reviewer: independent cognitive-accessibility specialist.

### Page-not-found guidance

Result: PASS. The page names the problem and offers home or search as recovery
paths. Source-text review only.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `website/src/content/docs/404.md` | `c67038cd4b28cb6a4d778ec3cbf327c978e90be856589d0fea1f24ddcb7e225d` |

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
