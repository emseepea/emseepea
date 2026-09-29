---
status: in-progress
story-id: resolve-the-vulnerable-lockfile-dependency
reported: 2026-09-29
decision-makers: [Tom Howard]
problems: [P017]
jtbd: [JTBD-101]
rfcs: [RFC-003]
story-maps: [STORY-MAP-001]
estimated-effort: S
---

# STORY-003: Resolve the Vulnerable Lockfile Dependency

**Reported**: 2026-09-29
**Problems**: P017
**JTBD**: JTBD-101
**RFCs**: RFC-003
**Story Maps**: STORY-MAP-001
**Estimated effort**: S

## User value

In order to keep safe releases moving, as a framework maintainer, I want the
locked development dependency updated within its compatible range and checked
by the existing security and exact-commit gates.

## Acceptance criteria

- [x] The root lockfile resolves `undici` to fixed version `8.11.2` without a
      package-manifest change.
- [x] `npm ls undici --all` reports no vulnerable `undici` version.
- [ ] The repository's existing Open Source Vulnerabilities scan passes.
- [x] Exact local qualification passes.
- [ ] The exact-commit GitHub Quality run passes before the blocked package
      release resumes.

## Driving problem trace

P017 records that a newly disclosed vulnerability in the locked development
dependency graph stopped the required Quality workflow before publication.

## JTBD trace

JTBD-101 requires framework maintainers to publish only packages whose exact
source revision and dependency graph passed the governed release controls.

## Implementation notes

Use the compatible transitive resolution already permitted by `unifont`; do
not add a dependency, manifest override, workflow, or changeset.

## Dependencies

- **Blocks**: P007 release completion.
- **Blocked by**: (none)

## Related

- P017 Known Error record.
- R007 release-pipeline supply-chain risk.

(captured via `/wr-itil:capture-rfc`; expand at the next
`/wr-itil:manage-story` invocation)
