# UI Initializer Accessibility Review

- Date: 2026-09-02
- Result: PASS
- Scope: Native HTML and React UI examples used by their initializer packages
- Environment: macOS 26.3 build 25D125, Google Chrome 152.0.7977.65, VoiceOver 10

## Manual Checks

Both examples exposed the exact document title `Bean report preview - Em See
Pea` and a skip link. The native example exposed the level-one heading `Native
form example`. The React example exposed the level-one heading `React and
Tailwind form example`. Both continued with the level-two heading `Preview a
bean report`. VoiceOver announced every form control with its visible name and
required state. Keyboard Tab navigation reached the skip link and controls in
document order.

Submitting an empty required report title kept focus on the named Report title
field and exposed the browser message `Please fill in this field.` Submitting a
valid form moved focus to the result container and exposed the level-three
heading `Preview ready` followed by `3 sample beans match. No report was sent or
stored.`

VoiceOver was turned off after the checks.

The packed-project test created both UI starters outside the monorepo, installed
their dependencies, and passed their retained browser and accessibility checks.
See `tests/docs/packed-getting-started.test.mjs` for the executable check.

## Reviewed Source

| File | SHA-256 |
| --- | --- |
| `examples/native-ui/src/server.ts` | `12545d264944ae33a78d65b8780f1f5d36d243234df498d48684307d1d7b18d8` |
| `examples/react-tailwind-ui/src/server.tsx` | `cab877809027b3cba29b1943280888fd590ae28f552dd11d9635c79a06c1c47f` |
| `examples/react-tailwind-ui/src/client.tsx` | `20a768ff57576b884ed4cd3f74f979a8f0a348bd4323518f4f8c324d8f71710f` |
| `examples/ui-shared/test/browser-contract.mjs` | `725d6bd6620dd738ad0eaecd030eb44b81c577a2b02805fb0b9d8ca0a8d08a79` |
| `packages/react/src/index.tsx` | `55645541c5ae64db3611a4676247a5406fe398f0e91e0a3fafedb149f5809cf4` |
| `packages/tailwind/src/emseepea.css` | `2389d13e1c423d8d9ecdfd3b901920aa1de02811f3035c60d5edf5bfaa363cba` |

## Evidence Boundary

This manual review covers VoiceOver with Chrome on macOS. It does not claim
manual verification with Safari, Windows screen readers, or mobile screen
readers. Automated browser checks remain required for both generated projects.
