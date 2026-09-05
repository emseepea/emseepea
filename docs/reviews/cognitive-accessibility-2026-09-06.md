# Cognitive-Accessibility Review 2026-09-06

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

No em dashes or emoji were found in the six reviewed public Markdown files.

This review covers source prose. It does not establish package publication.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/tidy-pea-routes.md` | `c28bd3eb54843960f3c26e2eead5a2099c1bac3890aaeec58de4409eb5cf1259` |
| `examples/html-ui-server/README.md` | `d50ee25dde0537cc56e9457b080ae548ee8547e82d37e0357fa427c766e43635` |
| `examples/react-ui-server/README.md` | `998402c867ba47196a5616662e321dc41b93b841beb25cbf4847ad02637f8b75` |
| `packages/framework/README.md` | `43a98139b2eb43de438d2c73f548d0d8f1a85e1c99d9f73800c446196a82c512` |
| `website/src/content/docs/examples.md` | `2196bee33c2eacab520837d31d8ec0450799beba4944e99c637a66728bbe8380` |
| `QUALITY.md` | `6414620becc890a94da50b56b327f3ce982ba0a0f723892db517e76750fecc4f` |
