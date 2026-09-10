# Cognitive Accessibility Review, 10 September 2026

## Capability Discovery Suppression

Result: PASS. Codex reviewed the exact changed public Markdown using the
repository's Markdown accessibility workflow and cognitive-accessibility
checks. The wording uses descriptive headings, short paragraphs, a numbered
retirement sequence, and consistent terms for visible, hidden-but-callable,
permission-hidden, disabled, and removed states. The code block has a language
label. There are no images, tables, diagrams, emoji, visual-only instructions,
or inaccessible links. No blocking accessibility finding remains.

- `.changeset/quiet-peas-retire.md`
  SHA-256: `398b68754974e8d67b38774efabb178d322d0d97016599a48997c8f3bb1890a8`
- `docs/decisions/0067-capability-local-static-discovery-suppression.proposed.md`
  SHA-256: `f98c664039276ddf107914d7fd62de34b0e993d81b65428303c3bf55ea35968f`
- `docs/decisions/README.md`
  SHA-256: `6889933fbceb2ad33a549ab94f29da8c6939dfbeb92a06b8b926235eb0815037`
- `docs/protocol-coverage.md`
  SHA-256: `e80df7f16128a053a734e760c4a12b83e49170e4f7209e494ba89cfe636cbe42`
- `packages/framework/README.md`
  SHA-256: `a0360114a8e2fb1bd8e94667e7fdd2aef46646e25043fa81707f2526c8732b4e`
- `website/src/content/docs/examples.md`
  SHA-256: `d94be26646dbca74a873667530a614bc66056cb95663f5ad887d31b9a0c88bd3`

## Resource Catalogue Boundaries

Result: PASS. Architecture, voice and tone, and Markdown accessibility reviews
covered the exact public guidance. The wording separates catalogue metadata,
application record search, and resource reading. It uses short paragraphs,
descriptive headings and links, exact MCP method names, and no visual-only cues.

- `README.md`
  SHA-256: `a9657a5a921acdead8df8844277b75aa243b69f2a4c907e27e6dfa2ae2890884`
- `docs/protocol-coverage.md`
  SHA-256: `28929ee1723b60dbc0861010a01640d1ebfa6daac17fe203c4556e924dee1dcd`
- `packages/framework/README.md`
  SHA-256: `37755c754845306268cb8e2943b30dc04e00041d8ba7ce500a2ab2d12968aec3`
- `website/src/content/docs/examples.md`
  SHA-256: `9fd4b1101d4afdd40235313369c962900eb76ff605dbb18066a1cc0db84a5598`

## Optional Feedback Semantic Assertion

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the exact release note and public testing guidance. The text
limits optional feedback to deliberately unsuccessful journeys and keeps
successful journeys subject to exact tool and negative-feedback assertions.

- `.changeset/brave-peas-answer.md`
  SHA-256: `e2e59c76b8f205aeb10daf3a8ec1ef5ff2ca42a0c792dc4b6825480eba3d7f0a`
- `packages/testing/README.md`
  SHA-256: `cbfeab675e46dc5e9cfef53bdb87f4b0de34cfc3a50b3293bcf1c57ec999966c`
- `website/src/content/docs/ai-tests.md`
  SHA-256: `db2878ac78ee9a9e2f670c6bd74504f413faacb5d49441694d7574c6d076a37f`

## Optional Feedback Capability

Result: PASS. Independent accessibility and cognitive-accessibility reviews
covered the exact public documentation, release prose, examples, personas, and
decision record for the optional feedback capability.

The guidance uses plain language, predictable headings, descriptive links, and
short paragraphs. It clearly distinguishes open feedback disclosure from user
permission, explains stop-on-objection behavior, avoids comprehension claims,
and keeps normal empty-result controls understandable. No blocking
accessibility finding remains.

- `.changeset/friendly-peas-listen.md`
  SHA-256: `25779a407477a1e0db188dbe96bd13be633e8f00cff232f0ce58eb9df973f405`
- `.changeset/tidy-peas-wait.md`
  SHA-256: `ff3a3312d9b6cc1d300cd27f8b3ec8e7a230057da6ca62710ac3fe0b28c74899`
- `QUALITY.md`
  SHA-256: `7113617e1c3ee0276c02d1f908315e7ea771baebe15c14233822d061e6e58d26`
- `README.md`
  SHA-256: `c8b5f5da00dc921843519ea6bd383980baa28a9ed24c06c427de5637851a9964`
- `docs/decisions/0066-pluggable-detailed-feedback-conversations-and-event-hooks.proposed.md`
  SHA-256: `bb7191c90ad231e9874c179c70b923f3ff12c3e4a6b1c11742f8944ebe7d5ef0`
- `docs/decisions/README.md`
  SHA-256: `36029e806fb708f0429f5c0a9093199f42217d56236821e6186a63ed5eeaf6fb`
- `docs/jtbd/README.md`
  SHA-256: `8481731a970cb6ba550da3d3272f25b3eda146e77d0719aa9b4f4ba933c4ed1d`
- `docs/jtbd/feedback-operator/JTBD-300-handle-mcp-feedback-in-my-existing-support-system.proposed.md`
  SHA-256: `2764a32fd3b300c27583bbaa3e261f1fe86f20783c5ffb527691c37db69894d0`
- `docs/jtbd/feedback-operator/persona.md`
  SHA-256: `78c19eaa63e9971f8920928356bc7fd17bab9fa6d6eb4a85111de2395fc51e7a`
- `docs/jtbd/mcp-application-user/JTBD-200-give-feedback-without-disrupting-my-task.proposed.md`
  SHA-256: `c1f172c5a8358ef92ba5fc0742f02ebe5b6f198008ea4adfc0469ecfd4e6d113`
- `docs/jtbd/mcp-application-user/persona.md`
  SHA-256: `a6c2b93761aa51a81a97a5e24537da9c216016eb0c65632d66b27d0ba13337cb`
- `docs/protocol-coverage.md`
  SHA-256: `55a812343c694ab0b05c27d675b04cf753febedc6e4accd8c3f71ea84d0278f1`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `25f085f65627557f00d69913d7638c62a369c1744173318461ad01a2a92ac838`
- `examples/api-backed-server/README.md`
  SHA-256: `6ad1aa331fd951d4e6db054635039572fd0981dd3ebe89c1355983356f14efe1`
- `examples/database-schema-server/README.md`
  SHA-256: `5aa90f713d336c562df653c2e871b3be393a68b2e4e8d8c98bf8312c386242a0`
- `examples/html-ui-server/README.md`
  SHA-256: `17f4e206c3d708dc1b767e36972fbb0c912dc8eeb970e8d7b529e38d0eeee9da`
- `examples/mongodb-backed-server/README.md`
  SHA-256: `75d28b0be1fb9b7eb5726de111b0c926bc99549600438ac35163514afa2a6526`
- `examples/multi-instance-postgres-server/README.md`
  SHA-256: `bf173c389f3deb37ebd1bef7566c6e40190694b25f029ee2356e7b55593ecbb0`
- `examples/progress-streaming-server/README.md`
  SHA-256: `5a486bf7ec351ec4e5789726d5c15d3a05111ceb993d2a6e22eb5d64fda415c9`
- `examples/react-ui-server/README.md`
  SHA-256: `f24737b2516431174588f058677b133bf483ffea0e8f8cf477ae41c399f0ff05`
- `examples/resources-and-prompts-server/README.md`
  SHA-256: `f3e4f5747223399d905f18bd00ed14a3f5f118e9f0ca05c19b554646b0998612`
- `examples/soap-backed-server/README.md`
  SHA-256: `d49f4bc79eed035c9601e38f81240339512ac04e93bc92652cf547556b7dd1ef`
- `examples/tool-server/README.md`
  SHA-256: `4f81d1870d598533e624fbec907acd5fc38605816c549124a63f9ea960a10644`
- `packages/feedback/README.md`
  SHA-256: `a57e19fe042e8f4478bd75308d96312889f543f5b6e7d0dde5b5821f400f7294`
- `packages/framework/README.md`
  SHA-256: `d3472fbe36273a07af345d04b38d4d669b8fb2b1f6a53ef271b03c7db5ab49f6`
- `packages/testing/README.md`
  SHA-256: `f04737d48c0d1e82d52ff64af772087311983780373dd754ac428583dd787069`
- `website/src/content/docs/examples.md`
  SHA-256: `64c53ef2f03c1cb9b92e6e1871303f1552920a52a3c2706bd4e0e9bbc88aa248`
- `website/src/content/docs/feedback.md`
  SHA-256: `0cded81198ec2e2f17574f1522ef011da68bdade5de0a029d31e08c4a35e668c`
- `website/src/content/docs/index.md`
  SHA-256: `925644d4889bf2956067b8f6f205d0f0a5bb624ded719f90c2b49625ef951159`

## Feedback Semantic Release Repair

Result: PASS. An independent cognitive-accessibility review covered the exact
release note. The wording is plain, scoped, and readable. It contains no em
dash.

- `.changeset/clear-peas-speak.md`
  SHA-256: `569e874a489a42971b445123e60000f523acd7c0c0c882cf21097f854d5c8611`

## Voice and Tone Guide

Result: PASS. Named cognitive-accessibility, Markdown accessibility, ARIA,
keyboard, and heading reviews covered the exact guide and its link from the
brand style guide.

The guide uses short, task-oriented sections, concrete examples, consistent
terms, and direct recovery guidance. It treats ISO 24495-1:2023 as a
plain-language foundation, W3C cognitive-accessibility guidance as informative,
and ASD-STE100 as an informative source for technical instructions. It makes no
conformance or certification claim. No blocking accessibility finding remains.

- `docs/VOICE-AND-TONE.md`
  SHA-256: `40eacc22638c6bee4e3f2293f9df08dcc891bee52dc35bf7e5c06d4b132291c2`
- `docs/brand/STYLE-GUIDE.md`
  SHA-256: `19b4bcfbf17e50ebd528e470f5656e33dd70b709e71dc7d2e7fbea1ecd660297`

## Optional Positive Feedback Assertions

Result: PASS. An independent cognitive-accessibility review covered the exact
testing guidance and release note. The text clearly distinguishes exact primary
tool calls from one optional trailing feedback call and contains no em dash.

- `.changeset/fair-peas-report.md`
  SHA-256: `0c43fae9ee5573ad171f80c5033cd53da524e157ca1f38654927dc2ef16965c6`
- `packages/testing/README.md`
  SHA-256: `6e46e65c524338bf81c289b1d51ec25c9851e4ef666efd55c622963d39a50c95`
- `website/src/content/docs/ai-tests.md`
  SHA-256: `28ad12d3d7619332de3616bb71bb90741b02774f699b82945ca92651344a8439`

## Protected POST Progress Increment

Result: PASS. Architecture, voice and tone, Markdown accessibility, and
cognitive-accessibility reviews covered the exact ratified decision, release
note, reader guides, and generated compendium. The documents use short sections,
name the actor at the authentication boundary, and separate supported behavior
from excluded sessions, replay, and subscriptions. No blocking accessibility
finding remains.

- `.changeset/protected-proxy-progress.md`
  SHA-256: `35440562fb087e35334b460d2fa876f21887fc2f2f920f6439a5cd8519d5d87a`
- `README.md`
  SHA-256: `d45371772ed18fbc5348d503896c06daf318e18d516e1b6da3985917fabdc4cf`
- `docs/decisions/0030-public-post-progress-behind-a-trusted-proxy.superseded.md`
  SHA-256: `74124a59ac23893fb3f18b69e1b8464231c3aad9ed5f70d32b61c499c9888335`
- `docs/decisions/0068-protected-post-progress-behind-a-trusted-proxy.proposed.md`
  SHA-256: `55996cadfef642dcc3de1772dfc268ffa1744a0f090cf754698628e32f7401e1`
- `docs/decisions/README.md`
  SHA-256: `f13f40364f9e14d206ff3b63aaf540f35585f098ee0f686120cbd08e283142ed`
- `docs/protocol-coverage.md`
  SHA-256: `4c909612e5f1f4ccfbb4de57948954de8fa78843e31132282710924e920a8b49`
- `examples/progress-streaming-server/README.md`
  SHA-256: `e471bfd8d2ae5547aab5a47c6983d5e27e9c18bee870a6cd38821cefcf216fb0`
- `packages/framework/README.md`
  SHA-256: `99d7e143927546081d1978a1a6b86f7329894806d84adb8512b276e978a80db4`
- `website/src/content/docs/examples.md`
  SHA-256: `5d24115226a5478365629fb4d8821b8959b2881d9cd531dca215325f7c8a0c7e`

## Current Release Readiness

Result: PASS. Cognitive-accessibility and voice and tone reviews found no
blocking issue. The release scope uses short sentences and keeps local results
separate from required publication checks. Suggestions to add more labels and
replace specialist terms remain non-blocking.

- `docs/reviews/current-release-readiness.md`
  SHA-256: `3016eda2284fac71ef67f46f41247a706a97ee9d2b92bb1e7a1238d93695b1ba`
