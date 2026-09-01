# Cognitive-Accessibility Review 2026-09-01

## Model-Selected Tool Tests

Result: PASS. A cognitive-accessibility specialist reviewed the changed public
documentation after the final wording changes.

The documentation explains the test in three steps: the model chooses from the
advertised tools, the harness runs the accepted call, and the model answers from
the result. It keeps ordinary tests in `test/` and AI checks in `eval/`. It also
states that passing does not prove the same behaviour in every deployed client.

This is a source-text review. It does not establish package publication or the
behaviour of every model, client, prompt, or permission configuration.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/brave-peas-choose.md` | `c0e49e068ffa66038168d815aad011de6a9ec416a13220c0e231018cb4f607ce` |
| `README.md` | `80f3be5551599c64bddb62257c314b1d4396edfc4384856b457493ae3a96202a` |
| `docs/decisions/0029-code-first-semantic-tests.superseded.md` | `d45cccd1b609ca45f1ad15992f9cb3486cd9e8458eaa21c05b5e4ea746b34bd0` |
| `docs/decisions/0040-model-selected-tool-semantic-tests.proposed.md` | `d4df8e8df96c79140a1a0606b7ec4b0251df7a695ebf639fec9adb886696d424` |
| `docs/decisions/README.md` | `b13a3ed25ee0e2df86275e9e5a899ce709b466f7a263d686e8ba36df5dfccbb5` |
| `examples/backend-no-ui/README.md` | `17652a07bc166e6c53bbfdd4879a48899445a0a0f57186732ceca676389532d9` |
| `examples/basic-no-ui/README.md` | `08943d0de3fc14d51a63a2729ebd5c67e7877799aea7d878185a12689126fc8a` |
| `examples/multi-instance/README.md` | `13afef8a52153037d4a23d43d4eb38c6be07d72c241e7a570f20511d1784ec5c` |
| `examples/native-ui/README.md` | `1962c078f392a51255221ad1afa4cf2a34513df61d84aada41c6a9edb9a27b04` |
| `examples/protected-no-ui/README.md` | `4f010a25a221d12c2e37bc1f25727491cfa871fdfa729da8232e80c357c8d840` |
| `examples/react-tailwind-ui/README.md` | `05020c1096990f15abe9b4265d6e0fb5d8c5bea7db57547e40c33f8388d7871f` |
| `examples/streaming-progress/README.md` | `812b521801d09a66ac5aa695ae42f074991c5a8b53e985da6c1cffa756f6686f` |
| `packages/testing/README.md` | `5af52b7273936a2016afbc71fe6aa8341b177b2f75eb8030486091e68ef8b72a` |
| `website/src/content/docs/ai-tests.md` | `3ce68eeba178301f1ceeeaf6a06805cb558fcc3e63998e8a8ce7c141cca0b35f` |
| `website/src/content/docs/getting-started.md` | `ab74e082193305e45814f7ff4c56406e4ab1a424856a2783934e9e83157b965f` |
| `website/src/content/docs/index.md` | `1ce4e77273318228fc24fba31bf0dc3eb7e2261a6c936aece49d47110113b65c` |
| `website/src/content/docs/less-server-code.md` | `9257638e3727121394c23532959ebe51e3fd9078a81a56640a3c937703aa2a48` |

## GitHub Organisation Transfer

Result: PASS. A cognitive-accessibility specialist reviewed the current public
documentation after its repository and website links moved to the Em See Pea
GitHub organisation.

The updated material uses plain language, descriptive links, logical headings,
and readable grouping. It clearly identifies `emseepea/emseepea` as the current
source without rewriting historical release records.

| Reviewed file | SHA-256 of reviewed content |
| --- | --- |
| `.changeset/bright-peas-move.md` | `786e31584738cb82622fbac755763ba16895e425a2da5e26b346384f994320c9` |
| `BATTLE-PLAN.md` | `5e9ba0f9b8002347e64efdf3c72dc7cdf44d446f5e5de7a069f9c374a4f8117b` |
| `SECURITY.md` | `56a34f4f2b7f1fa89489a534580fb64dc298a3f73a29f81f0d8353daa72a3d3d` |
| `SUPPORT.md` | `4096381bc793a164cb84e09df885e7bb79de4b365ee2a131db9535ec36376b9f` |
| `docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.superseded.md` | `8c28ef041dd2fa6f7c32b86f758d2585c1b28f9113d135b9c553ff5916160119` |
| `docs/decisions/0041-em-see-pea-github-organisation-ownership.proposed.md` | `8f55ced4cd3af8304e9965953075cc4f7aef8f95eb7e483faa6813fc45d5b81b` |
| `docs/decisions/README.md` | `92d106213e40ee840bea279efee5cf616c6519b2c511b55f05d3b4164a75acd4` |
| `docs/protocol-coverage.md` | `5420d7a1a767f8f7487c6d5a37566240cd0eb35d84857bdbc9e95777165f0798` |
| `packages/framework/README.md` | `4a61ff7d138bfa052e02155ce8b9c30ab1a0a4bf5162685619f228446a3129a4` |
| `packages/testing/README.md` | `c90587c3e937cced8d083adf0c5f3bfc2587ed1a17cb1c647580a849fa371350` |
| `website/src/content/docs/ai-tests.md` | `84c667aa5713174459c4ba864514d14ecda108b693f08d6b9d61a730083599de` |
| `website/src/content/docs/examples.md` | `e29fde05ce9f875c36ca30868a62b9b4530fcfdd166a88f8c88da87102f1b7de` |
| `website/src/content/docs/getting-started.md` | `8af8a34ba1cb2589a960092e09bc6563739fccf9157e4b9f78a14158e2f3acaf` |
| `website/src/content/docs/index.md` | `270e8e72f9458733b60a42bf97ff366205dcc06d30787209ad7fa5876e9baf90` |
| `website/src/content/docs/less-server-code.md` | `649b7bb589012197113d11b67965329e1ad20c6c11cd404827742265a7bbc30d` |
