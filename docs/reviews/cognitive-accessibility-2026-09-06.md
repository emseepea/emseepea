# Cognitive-Accessibility Review 2026-09-06

## Public Schema Descriptions

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
review covered the framework guidance, Changeset, and release-readiness record.
The guidance explains why public schema properties need descriptions and shows
the descriptions beside their Zod constraints. The release note is short and
specific. The readiness record clearly separates source evidence, publishing
requirements, and post-publication checks. The reviewed files contain no emoji
or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/clear-schema-descriptions.md` | `f7da5d3d050934bc8ce6443a51b582645a80515e1347a4d03fb7d619ea746837` |
| `docs/reviews/0.3.2-release-readiness.md` | `2765f48e2b56ac65b0420ef665a85d4fad252e85d1768380b483f4d169327fe6` |
| `packages/framework/README.md` | `25c9b46c5fb1d2f3e703ec414776020d0015ee2c5b46d53f41dbb8b3d9340a5e` |

## Server 0.3.1 Prepublication Readiness

Result: PASS. The release-readiness record is clear about what is planned,
which evidence already exists, and what remains pending before and after npm
publication. It separates exact-commit qualification from publication evidence,
uses scannable headings and bullets, and contains no emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `docs/reviews/0.3.1-release-readiness.md` | `add6e2a19de6a8ef642bf8b9b9bec7c3ea67faeef0c02f04c1851306b46cba8a` |

## Schema Pass-Through and Shorthand

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
review covered the framework guidance and release note. The mapped-tool example
names each schema by its definition property, derives the public response from
the checked backend response, and shows the added source field directly. The
release note is short and specific. Neither file contains emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/clear-schema-shorthand.md` | `aecf6adff20edbc79b3bd0be1c27ecb30aca16710ae039e6b2030f9962f2a164` |
| `packages/framework/README.md` | `0ae00fc61cac481e8cff254051c767425d44835230f35d70fad6ac3a13e4a7a8` |

## Conversation-Style Semantic Tests

Result: PASS after three terminology corrections. Independent cognitive-
accessibility and Markdown accessibility review covered the new decision,
quality policy, package guide, website guide, and Changeset.

The final wording presents tests in conversation order, names each assertion's
purpose, explains that nine judgments apply to each meaning assertion, and
warns readers to use isolated test servers because selected calls execute
before assertions. It uses consistent conversation-test terminology and
contains no emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/bright-peas-converse.md` | `672fe3aaec9136e01642f1ae76ee605e2dcc09564f2cc68d9c3819a717b27fbe` |
| `QUALITY.md` | `a4cd9638b37576de30b96c2310dc9272054c4082636e4740b3653361050cee7c` |
| `docs/decisions/0040-model-selected-tool-semantic-tests.superseded.md` | `d4df8e8df96c79140a1a0606b7ec4b0251df7a695ebf639fec9adb886696d424` |
| `docs/decisions/0053-conversation-style-semantic-tests.proposed.md` | `4be08cee07e47cfbbc28ed4869761fa2b76e482d36202277cfaa858f2f49be0e` |
| `docs/decisions/README.md` | `9527bc9aaa837f21249959b308287c2942d5ce76a5a477fdad284ba762138004` |
| `packages/testing/README.md` | `6a06966f312c96432dad60ee6f681c6a7c7fffe82e02a96815e693578a8af4e4` |
| `website/src/content/docs/ai-tests.md` | `ccf56c9f832f430f851f66254c80917bac428ad063e4908e1509df2c8996fe73` |
| `docs/reviews/0.3.0-release-readiness.md` | `f696a200866293fd332ef1ff3256d71feaf685fa40c77640aa59c0a1ce71624a` |

## File Route Modules in UI Examples

Result: PASS. The reviewed prose is clear, scannable, and accurate for readers
choosing between the UI examples and using optional route discovery.

Review source: cognitive-accessibility specialist guide, Markdown accessibility
skill, and the installed `accessibility-agents-markdown` extension.

Source validation checked the current `registerRoutes` implementation, current
UI route modules, and current file-discovery tests. The framework README's
supported method list matches the implementation: `get`, `post`, `put`,
`patch`, `delete`, and `options`.

The website now separately describes the HTML route files and the React-only
browser-script route. This avoids making readers reconcile a shared claim with
different source trees.

Standards and rules:

- WCAG 2.2 2.4.6 Headings and Labels, by extension to descriptive section and
  task labels.
- WCAG 2.2 3.3.2 Labels or Instructions, for accurate setup instructions.
- COGA plain-language guidance for clear wording, consistent terms, and reduced
  memory load.
- `accessibility-agents-markdown`: public Markdown must be scannable, accurate,
  and free of avoidable wording noise.

No em dashes or emoji were found in the scoped reviewed public Markdown files.

This review covers source prose. It does not establish package publication.

## Server 0.3.0 Publication Review

Result: PASS. This historical review covered the server 0.3.0 route-discovery
release and its corrective initializer Changeset. The corrected UI route
wording accurately separates the HTML routes from the React browser-script
route. The Changeset is short, specific, and names the user-visible outcome.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/tidy-pea-routes.md` | `c28bd3eb54843960f3c26e2eead5a2099c1bac3890aaeec58de4409eb5cf1259` |
| `examples/html-ui-server/README.md` | `d50ee25dde0537cc56e9457b080ae548ee8547e82d37e0357fa427c766e43635` |
| `examples/react-ui-server/README.md` | `998402c867ba47196a5616662e321dc41b93b841beb25cbf4847ad02637f8b75` |
| `packages/framework/README.md` | `43a98139b2eb43de438d2c73f548d0d8f1a85e1c99d9f73800c446196a82c512` |
| `website/src/content/docs/examples.md` | `2196bee33c2eacab520837d31d8ec0450799beba4944e99c637a66728bbe8380` |
| `QUALITY.md` | `a4cd9638b37576de30b96c2310dc9272054c4082636e4740b3653361050cee7c` |
| `.changeset/fresh-pea-initializers.md` | `a1395700d67d2106997b406965d75131c8ea1375d96563174038cbc287458144` |

## Initializer Semantic Coverage Release Note

Result: PASS after replacing testing jargon with plain language. Independent
cognitive-accessibility and Markdown accessibility reviews covered the final
Changeset sentence and this evidence wording.

The release note says what improved, identifies short follow-up prompts, and
explains that AI-judged assertions remain limited. It contains no emoji or em
dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/wise-peas-compare.md` | `4cda5f348a716918e8dda8c4087d32181a693fafc22f10270fafbf24767fb06b` |

## Structured JSON Tool Results

Result: PASS after clarifying which clients use the JSON text fallback.
Independent cognitive-accessibility and Markdown accessibility reviews covered
the framework guide, website guide, and Changeset.

The guidance presents structured data as the default tool result, explains
validation and protocol output in execution order, and keeps custom text as an
explicit exception. It contains no emoji or em dashes.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/structured-json-tool-results.md` | `6f501a7cfb2b58039086ad85161c7330a5f4a2c046322c3ac4f4bc61ac3d1b43` |
| `packages/framework/README.md` | `0b30f95f07909ec7bc1de0ad82e26dad12e0bd161026da145ba9d6ef96ea7b9c` |
| `website/src/content/docs/getting-started.md` | `aaa288398bb8849e734969870d0d6385c8c99fd8d0a1d22458bd1804dcd3b77e` |
