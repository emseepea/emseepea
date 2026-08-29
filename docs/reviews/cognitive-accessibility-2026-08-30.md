# Cognitive-Accessibility Review 2026-08-30

Reviewer: independent cognitive-accessibility specialist using the Markdown
accessibility workflow.

Changed public prose reviewed:

- `.changeset/quiet-pods-build.md`
- `.changeset/calm-pods-route.md`
- `README.md`
- `docs/jtbd/README.md`
- `docs/jtbd/framework-maintainer/persona.md`
- `docs/jtbd/framework-maintainer/JTBD-100-extend-the-supported-protocol.proposed.md`
- `docs/jtbd/framework-maintainer/JTBD-101-publish-installable-packages-safely.proposed.md`
- `docs/jtbd/framework-maintainer/JTBD-102-keep-guidance-accurate.proposed.md`
- `docs/jtbd/mcp-server-developer/persona.md`
- `docs/jtbd/mcp-server-developer/JTBD-001-start-a-useful-mcp-server.proposed.md`
- `docs/jtbd/mcp-server-developer/JTBD-002-add-optional-capabilities.proposed.md`
- `docs/jtbd/mcp-server-developer/JTBD-003-prove-an-ai-understands-the-result.proposed.md`
- `docs/decisions/0029-code-first-semantic-tests.proposed.md`
- `docs/decisions/README.md`
- `docs/protocol-coverage.md`
- `BATTLE-PLAN.md`
- `docs/reviews/0.0.2-release-readiness.md`
- `docs/risks/R007-release-pipeline-publishes-the-wrong-or-compromised-package.active.md`
- `docs/risks/R004-public-claims-exceed-exact-evidence.active.md`
- `docs/risks/R010-guides-and-examples-drift-from-released-packages.active.md`

Result: PASS.

The review expanded unexplained abbreviations, replaced ambiguous headings,
removed release jargon, and split dense controls into plain-language
protections. The corrected files passed a second independent review.

The updated `R007` release-risk wording also passed an independent re-review.
It now says plainly that the release stayed blocked after a duplicate test
address and six high-severity dependency findings.

The pending code-first semantic-testing decision and its generated index entry
also passed an independent review after unexplained abbreviations and internal
engineering terms were replaced with plain language.

The MCP coverage ledger and updated battle plan passed an independent source
review after wide tables were replaced with stacked sections. The review also
required one named next decision, direct links to executable evidence, and
plain explanations of incomplete protocol work.

The routing-header release note passed after proxy and stream language was
rewritten to explain the adopter-visible protection in ordinary words.

The specialist also passed this exact public npm deprecation message:

> Do not use this version. Files needed to run this package are missing.
> Install a newer version instead.
