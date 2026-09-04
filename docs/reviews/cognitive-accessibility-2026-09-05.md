# Cognitive-Accessibility Review 2026-09-05

## Exact Tool Output Types

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the public Changeset after its final wording.

The Changeset states the compile-time behavior directly and limits the claim to
regular and streaming tool output properties. Its TypeScript terminology is
appropriate for framework maintainers. It contains no emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/quiet-tools-check.md` | `67f88f5e372589c5a1c2156596540a1d8c41f84173165a2da503dca97060290e` |

## Server 0.2.0 Prepublication Review

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the final prepublication record. It states the evidence boundary
directly and explains the two exact result labels required by the release
workflow. It contains no emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `docs/reviews/0.2.0-release-readiness.md` | `a6bd324e4d7b422f3cc34ae14522cf22e276926c5121db3965344fe0a2022491` |

## Schema-Declared Pass-Through

Result: PASS with non-blocking plain-language advisories. Independent
cognitive-accessibility and Markdown accessibility reviews covered the new
decision, generated decision summary, adopter guidance, example guidance, and
Changeset.

The guidance uses direct instructions and explains when values should pass
through unchanged. Reviewers noted that the confirmed decision uses `MCP`
before expanding it and uses `catalogue` where `list of values` would be
plainer. Those phrases remain understandable in this project context. They were
not changed after confirmation because confirmed decisions are immutable. The
adopter guidance uses `list of values`, and the example README expands Model
Context Protocol before using the abbreviation.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/tidy-coffees-pass.md` | `4347b2044cdb0b013c12c8a03606ad707d2cf769f5b72f112370d460d4a7b2d9` |
| `docs/decisions/0050-schema-declared-pass-through-by-default.proposed.md` | `92b6e124818cc6aa4c525ef4c9d9689c89edb1acfbdad39941f2c1f81a733120` |
| `docs/decisions/README.md` | `83913e47a968c79b393a3fcabf0a9bdbf4ffb750dfb6344dc02598f3b6f50f11` |
| `examples/backend-no-ui/README.md` | `6eee065d0624e1ce0c49a9228669654a73e9c37f6d535857f3dec0d56bc96ad0` |
| `packages/framework/README.md` | `2d21850982737196b474d431fbd4fd36066ba8a26628ca127220396d614f7014` |
