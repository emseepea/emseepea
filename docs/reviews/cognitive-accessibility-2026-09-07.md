# Cognitive-Accessibility Review 2026-09-07

## Native MCP Semantic Conversations

Result: PASS after correcting one long root README paragraph. Independent
cognitive-accessibility and Markdown accessibility review covered the semantic
testing API, user-facing examples, quality policy, decision records, risk
record, Changeset, and website guide.

The reviewed content explains that semantic tests must use native MCP client
journeys without prepared context that coaches tool choice. It keeps ordinary
tests separate from higher-cost LLM tests, uses descriptive headings and links,
and contains no emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/native-mcp-semantic-conversations.md` | `688d5e5672c05e0cd1c141a862a474a392d039ecccaacc5a2e9dd13ddc5e1216` |
| `QUALITY.md` | `3998535797f75f66cb59347c1abda298fb8e7b027f79771de20ce58123e3e3c7` |
| `README.md` | `30f08ddd1706bd19bcff275e0fea4a6a21d410549e4a5ea594265623100c8a62` |
| `docs/decisions/0053-conversation-style-semantic-tests.superseded.md` | `4be08cee07e47cfbbc28ed4869761fa2b76e482d36202277cfaa858f2f49be0e` |
| `docs/decisions/0054-provider-native-mcp-semantic-conversations.superseded.md` | `4c9a10a4621d5e45ee10e9bc299f816b8b07810726e313d68ccd0fe90f4b5eca` |
| `docs/decisions/0055-native-client-journeys-only-in-semantic-tests.proposed.md` | `395d91d4aedb53d444492226ea9790b91f62700765ffe4bfff24827365a1e8ef` |
| `docs/decisions/README.md` | `efa2ec5b97a420f4db1c58202f8875636ea613ef7e29b7bfa525079722f191f5` |
| `docs/risks/R005-semantic-qualification-misses-wrong-meaning.active.md` | `cbd8959527342a19133d36bd970ae8b3907b4d2f69c8e0bfacbdd801dc65fa06` |
| `examples/resources-and-prompts-server/README.md` | `bfd4e6050e9a98ce2b21bcaaa2d34df5353b067c91c406f495653b31338b5748` |
| `packages/testing/README.md` | `630911fb70b806c7e155373a4a1c9273cdc15885eedcfbdbafaef54c111f90df` |
| `website/src/content/docs/ai-tests.md` | `590f014c70c3fa3fd5c9cea1635ea8332e44195c18780f1adc4897af5f45e67b` |

## PostgreSQL Multi-Instance Initializer

Result: PASS after clarifying the deployment boundary, the local prerequisite
and run command, the superseded decision status, the current plan date, the
pending-publication gate, and the two-step SQLite creator retirement policy.
Independent cognitive-accessibility and Markdown accessibility reviews covered
the replacement initializer, release guidance, decision records, and website
guide.

The reviewed content presents one local run command after installation, names
PostgreSQL as required infrastructure, and avoids unsupported throughput or
cross-computer test claims. The current release-readiness text says publication
is pending exact Quality and release-risk evidence. The retirement policy now
says the reusable watcher deprecates exact old SQLite creator versions after
replacement verification, and a one-time release operator attempts exact package
removal when npm permits. The natural eval prompt clarification was considered;
it is source-code test prose, not a changed public Markdown surface. This review
covers source prose. It does not prove package publication or a deployed
environment.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `BATTLE-PLAN.md` | `53134cd4f552d8e31eded0769c83bfdadb69d1353f45e2113502a278029a5d5b` |
| `QUALITY.md` | `e70db3486f239fa25ae2a14fd14e9ae37110df9ee755b2faae0e2905e944ef50` |
| `README.md` | `8b09909abe59f125d42a534f1245071f5be59cfbe055ee92350e4c0356afa1c9` |
| `docs/decisions/0051-latest-as-default-public-npm-channel.superseded.md` | `e8687880b435c01f20fc98e150f8d99068237735639edcd0b97afd40eda690f2` |
| `docs/decisions/0056-postgresql-backed-multi-instance-initializer.proposed.md` | `ab2e5de268ab40586b7e2df1f325ba88639b9a0af612bf6acce519382dbf7cb0` |
| `docs/decisions/README.md` | `5388379e08809c15a75a8c7e47751e55945d7ee68d1eea6f701d9c1d5bc69b72` |
| `docs/reviews/current-release-readiness.md` | `f1fb8b289ff9c6f0f3d856b93e25266a6de1674dbf8b4c93e0caea221beaf316` |
| `examples/multi-instance-postgres-server/CHANGELOG.md` | `687b0fc66c10a408e9623a922267860ab815c58137509318c696ae9f0935aa66` |
| `examples/multi-instance-postgres-server/README.md` | `65ab1ad62a8945574cc5277a2199fa73b5b363f2c3fcb389ad371323d10c0d5c` |
| `website/src/content/docs/ai-tests.md` | `21da294101e5433c3d45e7d7da0f73fc481f9861ccb7de8540e1f98075903377` |
| `website/src/content/docs/examples.md` | `8451dbb98784f07fb02e32a925fc91c1792981717d63963e13bd16bf08f41bfe` |

## Inspectable Semantic Evidence

Result: PASS for cognitive accessibility and plain-language clarity on the exact
current changed public Markdown for inspectable semantic evidence. Independent
cognitive-accessibility and Markdown accessibility review covered the Quality
policy, testing package README, release-check README, website AI testing guide,
and Changeset.

The reviewed content keeps ordinary tests, semantic tests, smoke checks, local
checks, and release-approval evidence separate. It gives setup commands in task
order, states the Claude CLI and sign-in prerequisites before model checks, and
explains failure causes and recovery boundaries without blaming the reader. It
also keeps evidence-retention claims honest: synthetic conversations, advertised
MCP tool exchanges, and judge reasons are retained, while provider and harness
credentials, provider events, transport details, environment values, stderr, and
home-directory paths are excluded. It also says secrets placed inside test
content are not detected or redacted. No blocking cognitive-accessibility
finding remains.

Applied rule sources: cognitive-accessibility specialist reference,
`accessibility-agents-markdown`, and `accessibility-agents-web`.

This review covers source prose. It does not prove package publication, release
approval, real-model understanding outside the configured provider/model/server
journey, or production behavior.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/inspectable-semantic-evidence.md` | `9196dfa8df5f23313baeda02c1e7d98d9e46f0e97601e773a71a89f19d823c88` |
| `QUALITY.md` | `e9820c20b433a06ddb67f45c8bc609c0c82b2208a84073412e33ac7d1f8cdbb0` |
| `packages/testing/README.md` | `f5508f1f349fe4acdbf835b8aee1b047cb898859622212f1e711183fad87de83` |
| `tests/llm/README.md` | `4abc85d133c164909bcde42dd79250e5f473336931f2dc1ee2bea9161b777f8b` |
| `website/src/content/docs/ai-tests.md` | `1dd748683cda217d6ac30149a2dff08473c6a9b57aad882470c73d0d1e2502f3` |

## Clear Judge Failures

Result: PASS for cognitive accessibility and plain-language clarity on the exact
current changed public Markdown for clearer semantic judge failures. Independent
cognitive-accessibility and Markdown accessibility review covered the testing
package README, website AI testing guide, and Changeset.

The reviewed content tells readers what failure evidence contains, states the
safe failure causes that may be recorded, and keeps the warning about synthetic,
non-sensitive fixtures visible before users inspect or publish evidence. It does
not overclaim secret detection or redaction. No blocking cognitive-accessibility
finding remains.

Applied rule sources: cognitive-accessibility specialist reference and
`accessibility-agents-markdown`.

This review covers source prose. It does not prove package publication, release
approval, provider behaviour, or production behaviour.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/clear-judge-failures.md` | `1f05d43a7db50f1471eb2914c00d541796b04204f4bfc5c18e1530070a7dc3b5` |
| `packages/testing/README.md` | `e26709eaa24ba289a73288089fb26ffb7add496847505a08c82db20fd0ccd864` |
| `website/src/content/docs/ai-tests.md` | `9f6f628ffe242b9d960456d5180bcd1531f1e01e7e3d916d345be7744f9d723d` |

## Testing 0.5.1 Release Readiness Correction

Result: PASS for cognitive accessibility and evidence clarity on the exact
current release-readiness note for `@emseepea/testing@0.5.1`.

The reviewed content presents one release batch, explains the user-facing change
in concrete terms, and separates observed evidence from required publication
evidence. It corrects the stale release record without claiming npm publication.
No blocking cognitive-accessibility finding remains.

Applied rule sources: cognitive-accessibility specialist reference and
`accessibility-agents-markdown`.

This review covers source prose. It does not prove package publication,
registry state, or production behaviour.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `docs/reviews/current-release-readiness.md` | `5d6cf8fcbd95189db360a4c370253170c8ac67cddcf2c05429f8716464c2d057` |
