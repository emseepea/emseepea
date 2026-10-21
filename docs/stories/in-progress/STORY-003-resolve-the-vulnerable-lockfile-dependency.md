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

As a framework maintainer, I want to reduce exposure to known security
vulnerabilities while keeping releases moving. Update affected dependencies to
the newest stable version published at least 14 complete days ago. Check the
updates with the existing security checks for the exact source commit.

## Acceptance criteria

- [x] Direct Model Context Protocol dependencies resolve together:
      `@modelcontextprotocol/client`, `@modelcontextprotocol/server`, and
      `@modelcontextprotocol/core` at `2.3.1`;
      `@modelcontextprotocol/fastify` at `2.0.1`; and
      `@modelcontextprotocol/node` at `2.1.1`.
- [x] The SOAP example uses `soap@1.13.2`, and the website uses
      `astro@7.3.6`.
- [x] Root overrides select the newest stable fixes published at least 14
      complete days ago:
      `follow-redirects@1.16.1`, `launch-editor@2.14.2`, and `vite@8.3.3`.
- [x] The Open Source Vulnerabilities scan and release gate pass. Their only
      remaining findings are `braces` and `http-cache-semantics`, for which no
      published fix is available.
- [x] Exact local qualification passes for the exact source commit.
- [x] The GitHub Quality workflow passes for the exact source commit before the
      blocked package release resumes.

## Driving problem trace

P017 records that a newly disclosed vulnerability in the locked development
dependency graph stopped the required Quality workflow before publication.

## JTBD trace

JTBD-101 requires framework maintainers to publish only packages whose exact
source revision and dependency graph passed the governed release controls.

## Implementation notes

Use the newest stable dependency release that was published at least 14
complete days before selection. Keep directly related Model Context Protocol
packages aligned, and use the repository's existing root-override mechanism
for eligible transitive fixes. Do not weaken or replace the vulnerability gate.

## Dependencies

- **Blocks**: P007 release completion.
- **Blocked by**: (none)

## Related

- P017 Known Error record.
- R007 release-pipeline supply-chain risk.
- Exact source commit `9d6e7e33956a9c44c676361128f03bef69e06314` passed local
  qualification and GitHub Quality run `39521050752` on 2026-10-21.

(captured via `/wr-itil:capture-rfc`; expand at the next
`/wr-itil:manage-story` invocation)
