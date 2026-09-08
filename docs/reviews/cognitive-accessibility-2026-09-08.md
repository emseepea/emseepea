# Cognitive Accessibility Review, 8 September 2026

## Initializer Testing Dependency Release

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the exact changed release note and release-readiness record.

The content states what newly generated projects receive, distinguishes prior
evidence from required publication evidence, and does not claim publication.
No blocking accessibility finding remains.

This review covers source Markdown. It does not prove package publication,
registry state, or generated-project behaviour.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/fresh-testing-initializers.md` | `b9af7aafd69ec85260be5d7d9530fc1d9d6acab26361866324822d4d9704d263` |
| `docs/reviews/current-release-readiness.md` | `90380b10808a4299725a77ae836942d46bd9c40d5512d1cf9542100a7d15e4e1` |

## Answer Provider Failure Diagnostics

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the exact testing guidance, Changeset, and release-readiness
record.

The content identifies the failed answer trial, uses non-blaming language, and
distinguishes safe diagnostic categories from excluded provider data. It
requires fresh qualification before publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/diagnose-answer-failures.md` | `5783281b30188df94ea4907c1d9b9b5e255585041c26c0021102bdd0425ec00e` |
| `packages/testing/README.md` | `16292e2b927c6fde1f395290c69bb48cbec1b6f40a00d1a8f46d56dcc4323a20` |
| `website/src/content/docs/ai-tests.md` | `9788eed3258092ef14404337e2d71a358a6c4685a327d59b90fed6aea827edb1` |
| `docs/reviews/current-release-readiness.md` | `81e6438d7d1ce0586fa568a33870131d9c0103088838f340d70c12b54a1a79de` |

## Instance-Agnostic Shared PostgreSQL State

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the changed example, root guidance, website guidance, decision
records, Changeset, quality policy, and release-readiness record.

The content explains that generated apps use `private: true` to prevent
accidental publication. It presents interchangeable server processes and
shared application state without asking users to reason about routing. It also
gives unavailable local Docker checks no credit and requires exact-commit
PostgreSQL, standalone initializer, and semantic evidence before publication.

This review covers source Markdown. It does not prove package publication,
registry state, rendered-site behavior, PostgreSQL behavior, or model behavior.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/calm-peas-share.md` | `d0f70de60a2e8211080ad6903a573e9ed59eac1bc6814d0d86c9a810b551a776` |
| `QUALITY.md` | `4012aeb780e9728ac653951d703aed4666f617fabfc759039331b1340071e9fb` |
| `README.md` | `d96d087517e91a9f3305e51c008c7ca97b4bcb70283e499a07b3e046815274f0` |
| `docs/decisions/0056-postgresql-backed-multi-instance-initializer.superseded.md` | `ab2e5de268ab40586b7e2df1f325ba88639b9a0af612bf6acce519382dbf7cb0` |
| `docs/decisions/0058-instance-agnostic-shared-postgresql-state.proposed.md` | `1840bc04ee3ec64e98217cec30e4a6ca316b7e4d053ecd0f2e01ec8fc7f51ad7` |
| `docs/decisions/README.md` | `dbde657a5acd61e2f256bf4e83e01ab498e7c21dc028d46434efaef52cef8b4c` |
| `docs/reviews/current-release-readiness.md` | `eff77b229399b65af3880bcdac8298397c067735a3fcab6dfb3409dc74eaaa76` |
| `examples/multi-instance-postgres-server/README.md` | `d7511e82300133cd16b5cc8d39bcf44fb0fa42ab596b454828c91867a0cfb6b2` |
| `website/src/content/docs/ai-tests.md` | `759dc99f83ca706b87a32f72cff865fc75bf7366eea0356673cdbd67084d3ec4` |
| `website/src/content/docs/examples.md` | `bf9375845dda589edce423cbc6fe547045ac269b5105fda1fb68200c5ab5a617` |

## Process CPU as the Website Work Budget

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
review covered the changed performance-budget decision records and generated
decision compendium.

The content states the user-visible problem, explains which metric remains a
publication gate, and identifies which metrics remain diagnostic. The wording
keeps the tradeoff explicit without requiring readers to infer why an isolated
renderer sample should not fail publication by itself.

This review covers source Markdown. It does not prove CI status, website
publication, or runtime performance.

Applied rule sources: cognitive-accessibility specialist reference and
accessibility-agents-markdown extension.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `docs/decisions/0039-website-performance-budget.superseded.md` | `fdc093579984883e711cd87e006f6ae45d67ba0410fcbefe944d6f5af72d4923` |
| `docs/decisions/0059-process-cpu-as-the-website-work-budget.proposed.md` | `822a74af03f9a2772a2530c58f00973b768a3963b35db8c4e041997cc8559f63` |
| `docs/decisions/README.md` | `cd5e79eeeb950f757c60a8bfb281cb062ebc282758563694ee2bf6002374ac43` |

## Database, MongoDB, and SOAP Initializers

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the new initializer guidance, release evidence, decision
records, Changeset, root guidance, and website example chooser.

The guides distinguish the three integration choices, state what each schema
governs, and keep storage details out of the model-facing tool descriptions.
The release review separates local evidence from the exact-commit and registry
evidence still required. The generated decision compendium uses unique nested
headings for heading-list navigation.

This review covers source Markdown. It does not prove publication, registry
state, database behavior, SOAP behavior, or live model behavior. The rendered
website accessibility suite passed locally and exact-commit CI must repeat it.

Applied rule sources: cognitive-accessibility specialist reference,
accessibility lead, and accessibility-agents-markdown extension.

- `QUALITY.md`
  SHA-256: `40cce46b0a932d41c58db6df58f363c5e1070c0d803c3bf606c84d76ccc4c56b`
- `README.md`
  SHA-256: `38d03e6f566dc4f59e9277b55f314176ab8fa579d54f1084d5d9c3210dc0a31c`
- `docs/decisions/README.md`
  SHA-256: `48408729454a0df228627662e6e3ea414daaceb3fe880704350f19fba6571d53`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `6df22cf3856b154811f86706678dda4da3352109267afb8db781707dda3e992a`
- `examples/api-backed-server/README.md`
  SHA-256: `64daf8729a4998291c46296cec0d09f5b533e5f14e643dd9e7b40d55995d28c8`
- `examples/html-ui-server/README.md`
  SHA-256: `e22f8ab9c738d59d375cfd32f76830b9ef00654181f9e42761ae9aa8e057a308`
- `examples/multi-instance-postgres-server/README.md`
  SHA-256: `4587454e6a7990ffab6479725ce4cf40dca58fb4122c30869b3470775f0d0113`
- `examples/progress-streaming-server/README.md`
  SHA-256: `01b441c61188e41d6ba6ef0fc4695cd569413f311a3c8b6f2595810bd11811c3`
- `examples/react-ui-server/README.md`
  SHA-256: `74f8131da4dc417af1f903486009beb7b8f7e6a26328ef9fbd65ac45806db436`
- `examples/resources-and-prompts-server/README.md`
  SHA-256: `44d88903a15967027f603b21537374145f08708d8a286c9db2ae60fb45d60f71`
- `examples/sign-in-tool-server/README.md`
  SHA-256: `0a3f5c31881d0b397578705396ad2cc461f4ca1d97e8182ae50ad7599bf5d82a`
- `examples/tool-server/README.md`
  SHA-256: `88aaf0f48955b979f38ecaf3058a8cbe2c88298b01dab1cca76e4aeb757678b6`
- `website/src/content/docs/examples.md`
  SHA-256: `48f7807b0bb9cc5df7d7ba1b23848acd2c878dced49885429ce08d0830d8107d`
- `.changeset/green-pea-integrations.md`
  SHA-256: `64beaa46e8730519d05bd2f9e2403e57b8a9c289cce271f585e2d0a1da27c6f4`
- `docs/decisions/0060-database-schema-generated-internal-validation.proposed.md`
  SHA-256: `230d9ff2bc7897b38eca4e34ccbf1ddfa0bdce721abd5db59232c774d943c96f`
- `docs/decisions/0061-mongodb-json-schema-generated-internal-validation.superseded.md`
  SHA-256: `c503ad847c44d1f0c1adeeb337119109b8d0deacc65feda43945cd69004d519c`
- `docs/decisions/0062-wsdl-and-xsd-generated-soap-validation.proposed.md`
  SHA-256: `7aa735d62fb88ceea8828e923433fd3b93f6dad253d48a147c9a59ca74a37b5b`
- `docs/decisions/0063-two-mongodb-collection-validation-patterns.proposed.md`
  SHA-256: `2b4274dd6d95053430d3d93bc8dc93185e7de249977f9c3949e67e4573640ae1`
- `examples/database-schema-server/README.md`
  SHA-256: `bc3df741c188960a7688135aeef583069220995cc971a518a55da52fe3a36a27`
- `examples/mongodb-backed-server/README.md`
  SHA-256: `d80f4bb79383fde4711404bf830d9358dba33abf0689b55985b312baefa3987d`
- `examples/soap-backed-server/README.md`
  SHA-256: `04b53f7a841393a5d07cd780732730fd25b2bece1a3cac04817f6a619697b786`

## SOAP Contract Guarantee Clarification

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the corrected SOAP decision, generated compendium, and updated
release evidence.

The text distinguishes structural TypeScript guarantees from runtime namespace
and value-facet validation. It records one current performance measurement and
keeps local evidence separate from publication evidence.

- `docs/decisions/0062-wsdl-and-xsd-generated-soap-validation.proposed.md`
  SHA-256: `b24571dfc4b46675b645371f81ea3241c49c29a7bedbb280a3403fe25b8301fd`
- `docs/decisions/README.md`
  SHA-256: `ec2b013d7a52049465eda4889c005152fc5202b26f0011edafb752ffefe5f8d7`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `9cc20ed5bd476f78349361d86206ff71ce02b79ae358771f8c44c2b32dd9bf32`

## Trial Isolation and Final Evidence Corrections

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the final testing guidance, MongoDB configuration guidance,
Changeset, and release evidence.

The testing guidance distinguishes infrastructure isolation from model context
or coaching. The MongoDB guidance explains database selection without exposing
storage details to the model. The release evidence names measured SOAP traffic
and keeps local results separate from publication proof. No em dashes remain.

- `.changeset/green-pea-integrations.md`
  SHA-256: `d50c9a18d21fe0692242921f0c1efcc4d144e26f4fb9888fe11d8b63e60368a5`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `31314d4597cfa18db23812acdf50135cc8c85f625667fd1a949e21c1cdc4932a`
- `examples/mongodb-backed-server/README.md`
  SHA-256: `068438cdffaa7b2acb60009d728006cd99c0c63e7fc6a298bd8a04efc599e8f0`
- `packages/testing/README.md`
  SHA-256: `a7e2fd569a3b7e42b416ac89883a6595298a82126bf9b7e08db0256a3a62e729`
