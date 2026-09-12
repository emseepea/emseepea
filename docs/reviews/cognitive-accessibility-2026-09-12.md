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
exact combined MCP Sampling, MCP Apps UI example, and
`@emseepea/testing@0.9.12` release record. It is short, scannable, distinguishes
the three changes, and clearly separates local evidence from required
publication evidence.

- `docs/reviews/current-release-readiness.md`
  SHA-256: `c9aedd4ffc4d5223bfd810bc0d5965fa79c105407f121435745ea44df56169cf`

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
| `packages/framework/README.md` | `81fff03e3345d4eb6df0e86063cee8ac18cd49521c5b0b6a2ac7ccdb13f8f514` |

Scope: Changed public Markdown for the Sampling omission only. Runtime and
registry verification remain separate evidence.

## MCP Apps UI Resource Example

Result: PASS. An independent cognitive-accessibility specialist reviewed the
release note and public guidance. The wording is direct, task-oriented, and
distinguishes the standard MCP Apps fields from ChatGPT compatibility aliases.
No blocking accessibility finding remains.

- `.changeset/fuzzy-peas-render.md`
  SHA-256: `88f95857a5152bd601638023638fccacfdbc4ee0a81421ee5735fc707f286d53`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `02f2a787d210c6f9f99c71e4ec80fbc7284e36614a496db6566a61e8df6090e5`
- `examples/react-ui-server/README.md`
  SHA-256: `bba6dcff6744d1935b7b961488fff68a82a4c42c80f00de180a9f8a34c2ede07`
- `website/src/content/docs/examples.md`
  SHA-256: `f6cb1f9dcd45c4c84293a347662f6f2a252db33342f18dfe90301c4a279d8310`

Scope: Public guidance and release prose only. Runtime and host integration
evidence remains separate.

## Testing Protocol Selection

Result: PASS. An independent cognitive-accessibility specialist reviewed the
exact public README addition and changeset. The copy is short, direct, and
non-visual; it names the option, supported-revision boundary, modern default,
and legacy stateless path consistently.

| Reviewed file | SHA-256 |
| --- | --- |
| `packages/testing/README.md` | `5dcab6d885bd982289dc467afa094302335a26b64c3f2e8b6d066bc69108b4b6` |
| `.changeset/calm-peas-negotiate.md` | `e3eb0d2a384274dcb0d19a2e61c753532c2831640af263db60d8631c08894cd4` |

Scope: Public testing-helper README and changeset text only. Runtime behavior,
published-package verification, and unsupported-version diagnostics remain
separate.

## Checked MCP Content Blocks for Tool Results

Result: PASS. An independent cognitive-accessibility specialist reviewed the
proposed decision and its generated compendium entry. The title names the
outcome, the pending ratification state is explicit, and short sections separate
the chosen contract, exclusions, consequences, and confirmation checks. The
technical vocabulary is appropriate for framework maintainers, and the concrete
checklist reduces memory load during review.

| Reviewed file | SHA-256 |
| --- | --- |
| `docs/decisions/0082-checked-mcp-content-blocks-for-tool-results.proposed.md` | `819440b0b79c2d9d90288865d8d8fa3bab9208596b6b6f4ce427a8bcc8922be0` |
| `docs/decisions/README.md` | `77e035e386b50531ba59f688630c3b76a3272033ed6b16a0b81c5330d1ed31e2` |

Scope: ADR-0082 and its generated index and detail entries only. Runtime,
rendered mobile documentation, package publication, and registry evidence
remain separate.
