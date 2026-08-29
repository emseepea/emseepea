# Cognitive-Accessibility Review 2026-08-29

Reviewer: Codex using the Markdown accessibility workflow.

Changed public prose reviewed:

- `README.md`
- `QUALITY.md`
- `docs/risks/R001-published-content-is-not-understandable.active.md`
- `docs/risks/R010-guides-and-examples-drift-from-released-packages.active.md`
- `docs/risks/R012-framework-examples-obscure-correct-adoption.active.md`
- `docs/risks/README.md`
- `docs/reviews/0.0.1-release-readiness.md`
- `examples/backend-no-ui/README.md`
- `examples/basic-no-ui/README.md`
- `examples/multi-instance/README.md`
- `examples/native-ui/README.md`
- `examples/protected-no-ui/README.md`
- `examples/react-tailwind-ui/README.md`
- `examples/resources-prompts/README.md`
- `examples/streaming-progress/README.md`
- `packages/framework/README.md`
- `packages/react/README.md`
- `packages/tailwind/README.md`
- `packages/testing/README.md`
- `packages/framework/CHANGELOG.md`
- `packages/testing/CHANGELOG.md`

Result: PASS.

Checks made:

- The root README now names what people can build, not just framework
  capabilities.
- The example READMEs now start with a short "choose this when" cue so readers
  can pick the right starting point without remembering the whole feature list.
- The React and Tailwind package READMEs show the smallest opt-in snippet and
  avoid claiming npm publication before it exists.
- An independent cognitive-accessibility specialist passed the root guide, all
  eight runnable example guides, all package guides, and the path from each
  example guide to its entry source after the reported issues were fixed.
- The README density guard now checks root, example, and package READMEs instead
  of checking only the root README.
- The release-readiness and risk records state what passed, what remains out of
  scope, and why the residual ratings changed.
- The risk entry describes the failure mode, control, and monitoring in plain
  language.
- The README density guard still covers the observed wall-of-text failure mode.
- This review record is intentionally short so it does not become another
  unreadable document.
