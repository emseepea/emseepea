---
status: "proposed"
date: 2026-09-15
human-oversight: confirmed
oversight-date: 2026-09-15
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review", "Voice and tone review"]
informed: []
reassessment-date: 2026-12-15
---

# Deprecated Client Logging Kept Out of Adoption Guides

> Captured via `/wr-architect:capture-adr`. The section content was derived
> from the in-session decision context. Tom Howard confirmed human oversight
> on 2026-09-15.

## Plain English Summary

Em See Pea will not teach developers to adopt deprecated Model Context
Protocol (MCP) client-visible logging. Reader-facing guides will keep concise
compatibility facts but will remove logging tutorials, examples, feature
promotion, and adoption links.

## Context and Problem Statement

MCP `2026-07-28` retains deprecated client-visible logging. Em See Pea already
supports bounded request-scoped logging for compatibility.

Some public guidance still promotes client-visible logging. The root README
lists it as something to build and test. The website and server-package
client-logging tutorials were already removed in commit `aa6e1ec0`, but the
project needs one durable rule that applies consistently to reader-facing
adoption guidance.

Removing every mention would also be inaccurate. Maintainers and adopters still
need to know what compatibility behavior exists, which features are deprecated,
and what to use instead.

## Decision Drivers

- Complete non-deprecated MCP server work before spending more effort on
  deprecated features.
- Keep new applications away from client logging that MCP no longer recommends.
- Keep runtime compatibility and public APIs unchanged by a documentation-only
  decision.
- Preserve exact compatibility, migration, and evidence boundaries.
- Apply one rule across the root README, package and example guides, and the
  documentation website.
- Serve JTBD-102, Keep Guidance Accurate, without erasing release history.

## Considered Options

1. **Remove client-logging adoption guidance while keeping factual coverage
   (chosen)**: remove tutorials, examples, promotion, and adoption links, while
   retaining concise compatibility facts, changelogs, and ADRs.
2. **Keep all current guidance**: continue teaching deprecated features because
   the runtime still supports some of them.
3. **Remove every client-logging mention**: delete adoption guidance and factual
   compatibility records together.
4. **Remove client-logging runtime support as well**: combine documentation
   cleanup with a breaking public API and behavior change.

## Decision Outcome

Chosen option: **"Remove client-logging adoption guidance while keeping
factual coverage"**, because it stops directing new applications toward
deprecated client-visible logging without hiding compatibility limits or
changing runtime behavior.

Reader-facing adoption and how-to guidance includes the root README, package
and example READMEs, and documentation website pages. These surfaces will not:

- promote client-visible logging in a current feature list;
- teach a developer how to configure or call client-visible logging;
- include a copyable client-logging example; or
- link to a client-logging adoption tutorial.

Concise factual material remains where readers need it. Protocol coverage may
state whether a deprecated feature is supported, intentionally unsupported, or
legacy-only. Migration guidance may direct readers to a current alternative.
Changelogs and historical ADRs remain unchanged. The client-roots compatibility
guide required by ADR-0079 remains. The Sampling alternative required by
ADR-0081 remains.

This decision changes documentation only. It does not remove runtime
compatibility, public APIs, tests, or release evidence. Client-visible logging
remains available for compatibility but is not recommended for new
applications.

## Consequences

### Good

- New applications are not guided toward deprecated client-visible logging.
- Readers still receive accurate compatibility and migration information.
- Existing adopters retain the same runtime behavior and public APIs.
- Historical decisions and release records remain intact.

### Neutral

- Deprecated compatibility code and tests remain until a separate ratified
  decision removes them.
- Developers maintaining an existing integration use factual protocol coverage
  and API types rather than a new-adoption tutorial.

### Bad

- Supported compatibility APIs become less discoverable to developers who
  still need them.
- Maintainers must distinguish adoption guidance from factual coverage during
  documentation reviews.

## Confirmation

- Search the root README, package and example READMEs, and website guides for
  client-visible logging.
- These adoption surfaces contain no client-logging tutorials, copyable
  examples, current feature promotion, or adoption links.
- `docs/protocol-coverage.md` still states the exact client-logging
  compatibility boundary and distinguishes it from server-operator
  observability.
- The client-roots compatibility guide and Sampling alternative remain.
- ADR-0075 and client-logging changelogs remain as historical and compatibility
  evidence.
- Runtime source, public API declarations, and protocol tests are unchanged.
- Documentation, cognitive-accessibility, website-build, and website-size gates
  pass.
- The published website is fetched independently and contains no removed
  deprecated-feature adoption guide.

## Pros and Cons of the Options

### Remove Client-Logging Adoption Guidance While Keeping Factual Coverage

- Good, because it gives new adopters current guidance without hiding supported
  compatibility behavior.
- Bad, because existing compatibility APIs have less tutorial coverage.

### Keep All Current Guidance

- Good, because every supported API remains easy to discover and copy.
- Bad, because new applications are encouraged to adopt features the protocol
  deprecates.

### Remove Every Client-Logging Mention

- Good, because the public guidance becomes shorter.
- Bad, because it hides compatibility behavior and removes evidence needed to
  understand existing integrations.

### Remove Client-Logging Runtime Support as Well

- Good, because documentation and runtime would expose only recommended
  features.
- Bad, because it creates a breaking change outside this documentation
  objective and requires a separate migration and release decision.

## Performance Review

This decision changes static documentation only. Application-server CPU and
memory deltas are 0 per MCP request. The remaining implementation removes two
root README bullets totaling 162 source bytes. It changes no generated website
page, so the website gzip, browser CPU, and browser memory deltas are 0 per page
request. Frequency source: no data, using a worst-case assumption of 10,000
README views per day. The aggregate source-content reduction is 1,620,000 bytes
per day, about 1.55 MiB. Existing website size, 800 ms desktop CPU, 2,000 ms
slowed-profile CPU, and 512 MiB memory gates remain unchanged; budget verdict:
PASS.

## Reassessment Criteria

Reassess if a selected MCP revision restores client-visible logging without a
deprecation marker, adopter evidence shows that factual coverage is
insufficient to maintain compatibility, or the runtime API is removed through
a separate ratified migration decision.
