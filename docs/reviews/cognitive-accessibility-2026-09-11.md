# Cognitive Accessibility Review, 11 September 2026

## Release Retrospective and Problem Capture

Result: PASS. Named cognitive-accessibility specialist review covered the exact
retrospective briefing, ask-hygiene record, problem inventory, and two release
problem tickets. Headings are descriptive, instructions and evidence are
direct, and the compact tables remain understandable without relying on visual
position or colour. This review covers source Markdown only.

- `docs/briefing/README.md`
  SHA-256: `df06d9b78e8a79e00f682526eeff45fe136c521d4258e2e549ab9d91d7c6491a`
- `docs/briefing/releases-and-ci.md`
  SHA-256: `be80ea6331c5553e81ecc0105c958c318ba4dcb5ffb8c6801e9419052af38b0b`
- `docs/problems/README-history.md`
  SHA-256: `c9b667742bcb8386a5923e2c7485d037eb5202bbbf8a05966faa3598c25e96db`
- `docs/problems/README.md`
  SHA-256: `79c41d02582488254b3aa2b229a7ab547bcc60afb39be5b1d4c68ea183f9d69b`
- `docs/problems/open/001-changesets-omit-initializer-bumps-when-embedded-template-dependencies-change.md`
  SHA-256: `7ff6fdd5c3eb920f1b8bd1cabb765fb03bd8c94ed564c316f859b4f95254a900`
- `docs/problems/open/002-release-readiness-verifier-only-tests-fixture-like-stable-pass-marker.md`
  SHA-256: `b4f89c6bb6771055bfbcd992faffb0d9a45a7554c2df19aad19e2750e84ffa3b`
- `docs/retros/2026-09-11-ask-hygiene.md`
  SHA-256: `bc95f0e68b3c07b7b3e6168d668915c3df55f8f4604b78afa2accc095010d4fd`

## Feedback Disclosure and Semantic Qualification

Result: PASS. Independent cognitive-accessibility review covered the exact
release note and public feedback guidance. The additions use short paragraphs,
direct instructions, and consistent terms for the original request and feedback
disclosure. No visual-only instruction, inaccessible link, or blocking finding
remains.

The technical acronyms fit the developer audience. A glossary may help if the
audience broadens beyond developers.

- `.changeset/clean-peas-answer.md`
  SHA-256: `f277ffb7c64684dad87ffe8dedcf806a309e62db9ef5378d4cbb5892fe977741`
- `packages/feedback/README.md`
  SHA-256: `cd6d30b4a6a7c52880b300e6870a3e4657e2bc28415af1ce6a49315ec284dd67`
- `website/src/content/docs/feedback.md`
  SHA-256: `9e8fba377fb21cbc55a84a472cb521264c799aa7640ae0a6c1d9fcc7ca54fae4`

## Current Release Readiness

Result: PASS. Independent cognitive-accessibility review covered the exact
current release-readiness document. Its package list and user-change summary
are clear, local evidence remains separate from required publication evidence,
and the unpublished disclaimer prevents an early publication claim.

- `docs/reviews/current-release-readiness.md`
  SHA-256: `0dd5cca65f832e831a7c2127893e1f7e1ee4e2a9fab89e95b1dff0c43731a21f`

## Resource Catalogue and Subscription Guidance

Result: PASS. Independent cognitive-accessibility review confirmed that the
current protocol and framework guidance clearly distinguishes registered
resource metadata from application records and resource contents. It also
states the supported resource-update subscription scope and limits directly.
The rejected decision is clearly labelled as immutable historical material
rather than current guidance.

- `docs/decisions/0069-atomic-runtime-activation-of-startup-compiled-capabilities.rejected.md`
  SHA-256: `5ab205673955012d96c319e2a4b90ed4e622fd7bbf7bf0f628729d3f08b90414`
- `docs/decisions/README.md`
  SHA-256: `27e6fd69db7597a85079902145b35bf3dcf8c16fe33fa520bd4f8e592f9648fd`
- `README.md`
  SHA-256: `81f81f6af9c8029c84193d2d8bab6a9a9933b4080a8e2c67da06dee95dd57a00`
- `docs/protocol-coverage.md`
  SHA-256: `4421860bc26c82b572ae184e32d6047aab34ed0dd8ced796d99ba54906464145`
- `packages/framework/README.md`
  SHA-256: `a89f81b682bcb057fbba851b7cb543959e796bc7cd9d69ec08d344d938cb78c4`
- `.changeset/calm-resources-listen.md`
  SHA-256: `994821830081410d943d9d021d1434732b392442806e014b4ae156cbf5e1df3d`

## OpenAPI-Backed Initializer

Result: PASS. Independent cognitive and Markdown accessibility review covered
the new initializer, the OpenAPI and no-spec choice, both linked decisions,
the generated decision index, and current release readiness. Headings are
coherent, links are descriptive, instructions are direct, and current and
superseded decisions are clearly distinguished. The review covered source
Markdown; the exact-commit website gate remains responsible for rendered-site
verification.

- `.changeset/cool-pets-generate.md`
  SHA-256: `0455efc2c2497d4b1e57d3acc9845ee7a1ee4c71f0c558c52ec82ce8daaad6c7`
- `README.md`
  SHA-256: `12858eb3776c2db9bf58b875e7f8d9376727f87d0e5d049108c9064bc4fca0c2`
- `docs/decisions/0070-openapi-generated-backend-types-and-runtime-validation.superseded.md`
  SHA-256: `bc20f39d54e894e2089d55ee342b0c724f840dce4318a4033e96708410588f36`
- `docs/decisions/0071-separate-openapi-backed-example-and-initializer.proposed.md`
  SHA-256: `a573f3b2ce1da5b17678cbb891b455d1f2fbdbba3646e145bda7c28aea08269f`
- `docs/decisions/README.md`
  SHA-256: `8654c7e01ecd9ebd4213126430448fa6550d9b6973b43f71ee4e09c009b7c67d`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `79dabcdbfe36d1e99d9f65749106281dcc3bdf9793eafd0806a2e32cacf2a986`
- `examples/openapi-backed-server/README.md`
  SHA-256: `0391e3c7e5d4712726569d8668cb7bae0330bd4fac5460d244aacd6f6088a13b`
- `website/src/content/docs/examples.md`
  SHA-256: `f23931ed80101c9e2b373018109a12a57a1cd3955a0329d156e711fa6d00f400`

## Protocol Scope Boundaries

Result: PASS. Independent cognitive-accessibility review covered the exact
scope correction and protocol-audit guidance. The wording clearly separates
application-owned resilience patterns from standard MCP work. It uses short
paragraphs, descriptive headings and links, consistent method names, and no
visual-only instructions.

- `README.md`
  SHA-256: `a7e829d6c9db79d1315b24ecd9e381eaeda556c3d10ef9963875fcbe88e60331`
- `packages/framework/README.md`
  SHA-256: `da4ae3a90e9863ad64aadd9304f87e3876f7098dfcafcb8bdeee81f533fbc03c`
- `docs/protocol-coverage.md`
  SHA-256: `f11f1d10a36e48a6cca3b6449d0e4eb513243615850e080ca7519bee5ceda982`

## Signed Request State

Result: PASS. Independent cognitive-accessibility review covered the exact
request-state decision, framework guidance, protocol ledger, release note, and
generated decision index. The wording distinguishes protocol state from
application-owned retries, replay prevention, and effect safety. Instructions
are direct, security limits are explicit, and no visual-only guidance remains.

- `README.md`
  SHA-256: `a7e829d6c9db79d1315b24ecd9e381eaeda556c3d10ef9963875fcbe88e60331`
- `packages/framework/README.md`
  SHA-256: `c2178c9362752eec87f5afa46a417cb9ab8f91d068f9181450bccb11cec172f2`
- `docs/protocol-coverage.md`
  SHA-256: `d148dd31ef83dbbcae9277ad9d494feab9c5fe0b480c0a3ea71eb2384afbba0f`
- `docs/decisions/0072-opt-in-integrity-protected-request-state.proposed.md`
  SHA-256: `68167fdb1c8f70a620f42a654ff0cf1710473f29d22730d3718f1ac5ff78dd6e`
- `docs/decisions/README.md`
  SHA-256: `0bcce41b687ff19f8ce334228cebb62dde7a3f4aab39d394451a074579c87b51`
- `.changeset/signed-request-state.md`
  SHA-256: `f0b2ebe001c40c24853f1504e064bb2e83a69619e85ea8fc2959e0b686acabdc`

## Context Analysis Retrospective

Result: PASS. Independent cognitive-accessibility review covered the exact
context-analysis report and its index entry. The opening identifies the source
without an ambiguous project decision reference, measurement limits are stated
next to the affected results, and headings and tables use direct labels. This
review covers source Markdown only.

- `docs/retros/README.md`
  SHA-256: `7f4cb1687bd47718547c724e4572ed6104fc39ff51e1e8daa4784d8498fb9905`
- `docs/retros/2026-09-11-context-analysis.md`
  SHA-256: `23c5c0632a56bdea68075375bb80c616b81b3d00e3f82df80c5abe5ddb69f7de`

## First-Package Publication Problem

Result: PASS. Independent cognitive-accessibility review covered the exact new
problem ticket and updated problem indexes. Weighted Shortest Job First and
Jobs To Be Done are expanded on first use, the duplicate-check evidence uses
plain language, and the recovery and investigation actions are direct. This
review covers source Markdown only.

- `docs/problems/README.md`
  SHA-256: `87a79f38f01b4a9971ebb7bf79b7aadff1ec73321c21902c1aaee11ca2120a6a`
- `docs/problems/README-history.md`
  SHA-256: `a78606898574fbc149d296c05e5f2cd3021da362135e072dbd16ea9c854658a9`
- `docs/problems/open/003-release-workflow-lacks-first-package-trusted-publisher-preflight.md`
  SHA-256: `41525d7b89ec7b77682dba9ca2eb51096f75032b449bbb06a53d4dcc415bdb1d`

## OpenAPI Release Retrospective

Result: PASS. Independent cognitive-accessibility review covered the exact
release briefing update and ask-hygiene record. Evidence labels, headings, and
table labels are understandable in context, and the release proof distinguishes
the exact commit and workflow runs. This review covers source Markdown only.

- `docs/briefing/releases-and-ci.md`
  SHA-256: `58c8f347a1fee5b4d6cced9676ce30fb45623ef927aa5c33aba56011d77e1b5e`
- `docs/retros/2026-09-11-ask-hygiene.md`
  SHA-256: `4141231cdf224fe4b5812a9f77a1e5e811da48dddf1dbd17a0b807f7967fabb8`

## Problem Backlog Parser Contract

Result: PASS. Independent cognitive-accessibility review covered the exact
parser-contract problem and updated problem indexes. The stable heading is
followed immediately by its plain-language expansion, and the evidence and
repair choices are direct. This review covers source Markdown only.

- `docs/problems/README.md`
  SHA-256: `d7d897d316ff5df933fff65091b8029e10fe2620dfce9a3cf214b86d04f626f5`
- `docs/problems/README-history.md`
  SHA-256: `a4475ddc0338e93be06d5360e68e2ead860e3d261d3e713aa6d763d52c13f5f2`
- `docs/problems/open/004-problem-backlog-parser-couples-to-an-unexplained-exact-heading.md`
  SHA-256: `5bd7275514ea78261cb22398d5f2a56155dff778472238ec79ec8c851fc866db`
