# Cognitive Accessibility Review - 2026-09-12

Result: PASS. An independent cognitive-accessibility specialist reviewed the
public release note. It clearly explains the corrected authentication failure,
uses consistent terms, and does not rely on visual position or colour.

- `.changeset/clear-peas-auth.md`
  SHA-256: `d967e2aad62e2f65be1bd5f0e592df9aa47ef52ae07558b10695aed0a8bb8cf3`

Scope: Public changeset text only. Runtime interfaces and authentication flows
were not part of this review.

## Large Tool Schema Type Inference

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the exact public changeset and TypeScript diagnostics. The
release note states the developer benefit first. Output mismatch diagnostics
name the affected handler contract and `outputSchema` directly. Technical terms
are appropriate for package consumers, and the Markdown introduces no
navigation or interpretation barriers. This review covers source content only;
published package verification remains separate.

| Reviewed file | SHA-256 |
| --- | --- |
| `.changeset/calm-tools-infer.md` | `fbe7937dbd4967a255082253d3a118ab5194ace72041dde6a3d66ad70940aa0f` |
| `packages/framework/src/index.ts` | `c23f567ae3dfc23c459860ed2319ca87f2efebde56d2d560e8c8a3857437bc36` |
| `tests/types/tool-context.ts` | `6634456419dd2c0ff47de86ff9e8b3fefe2f3d44f87fdbde8666335d7419c0a1` |
| `tests/docs/large-tool-schema-typecheck.test.mjs` | `7d3d3db6397ba422ca09c413fa46a3a991a5e1fb8877ec759fae517d518dafba` |

## Feedback testing-server readiness

Result: PASS. An independent cognitive-accessibility specialist reviewed the
public release note. It states the change directly, uses consistent terms, and
does not rely on visual position or colour.

- `.changeset/quiet-rivers-ready.md`
  SHA-256: `8b58032e32d326b4fc4e7ed12542fcf983de92a4679c0dae98fc5d09aced1383`

Scope: Public changeset text only. Runtime interfaces were not part of this
review.

## Current release readiness

Result: PASS. An independent cognitive-accessibility specialist reviewed the
exact four-package release record. It is short, scannable, and clearly
separates local evidence from required publication evidence.

- `docs/reviews/current-release-readiness.md`
  SHA-256: `f8bf3905ce22f7f7bfa821d00c45de4e9fd1eb1326f71d19b3cf5622ef1e43f6`

Scope: Public release-readiness text and evidence boundaries only. Publication
verification remains separate.

## Initializer Release Recovery

Result: PASS. Independent cognitive-accessibility, Markdown accessibility, and
voice reviews covered the exact initializer changeset and release-readiness
record. The copy states that release verification is incomplete, names the
planned versions, and separates published core-package evidence from the
remaining initializer publication and downloaded-package checks.

| Reviewed file | SHA-256 |
| --- | --- |
| `.changeset/fresh-starters-install.md` | `0be9a7c009b25ba1b9583c52cf4cd50f0055b3466bd8f7c21e2c9172854d906f` |
| `docs/reviews/current-release-readiness.md` | `b57cc9e6785d27768a4919bfe7e08e3ef4e19e633e368f6a8aeb1c60de0552fb` |

Scope: Public recovery changeset and release-readiness evidence boundaries.
Publication verification remains separate.

## Immutable Capability Catalogues Through Redeployment

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the ratified decision and its generated compendium entry. The
decision states the problem, chosen option, rejected alternatives, operational
consequences, and checks in predictable sections. It clearly preserves
`listChanged: false`, omits runtime catalogue replacement and list-change
notifications, and separates redeployment from replay, reconnect recovery, and
cross-process guarantees.

| Reviewed file | SHA-256 |
| --- | --- |
| `docs/decisions/0080-immutable-capability-catalogues-through-redeployment.proposed.md` | `21086b1ef5433502556c8c45835802cb0d8823491156e39151631792bc122e20` |
| `docs/decisions/README.md` | `bace9576d69471790c4178f94f990647d9d9f3e8cf0c9f6ce320c970641a82a0` |

Scope: ADR-0080 and its generated index and detail entries only. Runtime,
rendered documentation, link-check, and reader-comprehension evidence remain
separate.

## Application-Owned Model Provider Integration Instead of Deprecated MCP Sampling

Result: PASS. An independent cognitive-accessibility specialist reviewed the
ratified decision, generated compendium entry, package guidance, protocol
coverage, and release note. The text plainly identifies Sampling as
unsupported, explains the direct model-provider alternative, and distinguishes
the existing rejection boundary from a new runtime implementation. A Markdown
accessibility review found a valid heading hierarchy, no ambiguous links, and
no new image, table, diagram, or code-block accessibility concerns.

| Reviewed file | SHA-256 |
| --- | --- |
| `.changeset/quiet-peas-decline-sampling.md` | `585b6b277baeb88327b7dfd1696f15a7d22287b7b33cad4a12fb98a4118c7b9e` |
| `docs/decisions/0081-application-owned-model-provider-integration-instead-of-deprecated-mcp-sampling.proposed.md` | `5ed1e36efcf7cf4fc7cb9d44f5f29b93cf440414b67015267c8cb6dc4b8522dd` |
| `docs/decisions/README.md` | `f3ae4bfb3739d5cd983c49dcb8cadd4f1a9801f5afae5575fe70d55b625d57fa` |
| `docs/protocol-coverage.md` | `a5cb654f2e28f8a6979e452b20c3d78bbdac1c3067431f9e7635ba262f8e57ee` |
| `docs/reviews/current-release-readiness.md` | `8769573ac85926a8c486708a5defb4e99cc674a928d9eefdf7817869b0cf626e` |
| `packages/framework/README.md` | `82c7542abde710c4d867a2c7c313c7562ac6a62eb68391f0695a01b88eea89c3` |

Scope: Changed public Markdown for the Sampling omission only. Runtime and
registry verification remain separate evidence.
