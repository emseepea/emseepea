---
status: draft
story-id: explain-open-by-default-result-schemas-in-the-package-guide
reported: 2026-09-25
decision-makers: [Tom Howard]
problems: [P007]
jtbd: [JTBD-102]
rfcs: [RFC-002]
story-maps: [STORY-MAP-002]
estimated-effort: S
---

# STORY-002: Explain Open-by-Default Result Schemas in the Package Guide

**Reported**: 2026-09-25
**Problems**: P007
**JTBD**: JTBD-102
**RFCs**: RFC-002
**Story Maps**: STORY-MAP-002
**Estimated effort**: S

## User value

In order to keep guidance aligned with framework behaviour, as a framework
maintainer, I want the shipped package guide to explain that result schemas are
open by default and how to publish a closed contract.

## Acceptance criteria

- [ ] The package guide states that tool result schemas declared with
      `z.object` publish an open client contract that permits unknown fields.
- [ ] The guide states that a result schema declared directly with
      `z.strictObject` publishes a closed client contract.
- [ ] The guide states the P006 known limit: piping an open object into
      `z.strictObject` currently publishes an open contract.
- [ ] The guide states that opening the published client contract does not
      widen runtime responses: handlers may return only declared keys, and
      responses contain only declared fields.
- [ ] A focused documentation test passes and inspection of the packed package
      confirms that it contains the updated guide.
- [ ] A cognitive-accessibility review finds no unresolved issues with the
      section's wording or phone-width scanability.
- [ ] A changeset describes the package-guide correction.

## Driving problem trace

P007 records that the package guide omits the open-by-default published result
schema behaviour and the supported way to publish a closed contract.

## JTBD trace

JTBD-102 requires maintainers to check published guidance against the framework
behaviour it describes so adopters can follow it successfully.

## Implementation notes

ADR-0096 fixes the behaviour to document. ADR-0023 requires the published copy
to receive cognitive-accessibility review. Start implementation with the
failing (RED) documentation assertion recorded in P007, then make the smallest
guide change that turns it green. Do not implement before STORY-MAP-002 is
ratified.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)

## Related

- [ADR-0096: Open-by-Default Published Output Schemas](../../decisions/0096-open-by-default-published-output-schemas.proposed.md)
- [ADR-0023: Mandatory Cognitive-Accessibility Review for Published Content](../../decisions/0023-mandatory-cognitive-accessibility-review-for-published-content.proposed.md)

(captured via /wr-itil:capture-story as part of the P007 fix proposal)
