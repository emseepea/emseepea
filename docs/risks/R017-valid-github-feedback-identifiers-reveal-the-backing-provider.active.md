# Risk R017: Valid GitHub Feedback Identifiers Reveal the Backing Provider

**Status**: Active
**Category**: information security
**Identified**: 2026-11-05
**Owner**: Feedback package maintainer
**Last reviewed**: 2026-11-05
**Next review**: 2027-05-05

## Description

Library-generated feedback identifiers can name an adopter's internal tracking
provider even when the output passes its declared schema. Issue #236 and a real
Model Context Protocol (MCP) call against installed `@emseepea/feedback@0.11.11`
showed `github-issue-123` in a public submission receipt. Conversation and
webhook references used the same provider-specific convention.

This entry rates the GitHub identifier paths. It does not establish credential
exposure or unauthorized provider access. Other providers and application-owned
descriptions or feedback content are outside this assessment. Tom explicitly
accepts visible numeric identifiers; neutral prefixes do not prevent inference.
Unlike R003, the disclosure occurs through valid, schema-conforming output.

## Inherent Risk

Impact × Likelihood before controls.

- **Impact**: 3 (Moderate)
- **Likelihood**: 5 (Almost certain)
- **Inherent Score**: 15
- **Inherent Band**: High

## Controls

- **Provider-neutral public references** — Thread, body, comment and webhook
  event references use neutral prefixes consistently, with exact numeric lookup.
  Implemented in `packages/feedback/src/github.ts` and
  `packages/feedback/src/webhooks.ts`.
- **Public-boundary and correlation checks** — Actual MCP submission,
  conversation and reply-event results must omit provider-specific wording.
  Tests retain numeric correlation, reject invalid references before provider
  calls, and enforce scope checks. Implemented in
  `tests/black-box/feedback-provider-references.test.mjs`,
  `packages/feedback/test/vendor-adapters.test.mjs` and
  `packages/feedback/test/webhooks.test.mjs`.
- **Compatibility disclosure** — Upgrade guidance documents the deliberate
  reference/subscription break and how to obtain replacement references without
  duplicating submissions. Implemented in `packages/feedback/README.md` and
  `website/src/content/docs/feedback.md`.

## Residual Risk

Impact × Likelihood after the verified implementation and behavioral checks.

- **Impact**: 3 (Moderate)
- **Likelihood**: 1 (Rare)
- **Residual Score**: 3
- **Residual Band**: Low
- **Within appetite?**: Yes

## Treatment

Mitigate provider-name disclosure in library-generated GitHub feedback
identifiers. The new public-boundary, adapter and webhook checks pass locally;
release and independent installed-package verification remain pending. The
numeric identifiers remain visible under the confirmed scope. Existing provider
authorization and private deduplication keys are preserved. This record adds no
new release control.

## Monitoring

- **Trigger to re-assess**: Any change to a GitHub adapter, public identifier
  format or feedback event mapping; review again during #236 installed-package
  acceptance.
- **Metrics**: Provider-specific identifiers emitted by the assessed public
  paths. Monitoring alone receives no preventive-control credit.

## Related

- Criteria: `RISK-POLICY.md`
- Realised-as: [GitHub issue #236](https://github.com/emseepea/emseepea/issues/236)
- Related risk: [R003: Checked Boundaries Fail or Expose Backend Data](R003-checked-boundaries-fail-or-expose-backend-data.active.md)
- Personas affected: [MCP application user](../jtbd/mcp-application-user/persona.md),
  [feedback operator](../jtbd/feedback-operator/persona.md)

## Change Log

- 2026-11-05: Recorded the missed valid-output disclosure, the user-confirmed
  reduced scope and controls verified by actual MCP and event-boundary checks.
