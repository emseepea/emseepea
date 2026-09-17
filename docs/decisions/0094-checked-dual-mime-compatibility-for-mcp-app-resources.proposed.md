---
status: "proposed"
date: 2026-09-17
oversight-date: 2026-09-17
human-oversight: confirmed
supersedes: ["ADR-0093"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Jobs To Be Done review"]
informed: ["GitHub issue 102 customer voice"]
reassessment-date: 2026-12-17
---

# Checked Dual MIME Compatibility for MCP App Resources

> Captured via `/wr-architect:capture-adr`. The section content was derived
> from GitHub issue 102 and the architecture and Jobs To Be Done reviews.
> Tom Howard ratified the checked two-value MIME selection on 2026-09-17.
> Ratification records the architecture decision only; implementation and
> delivery remain separate.

## Context and Problem Statement

ADR-0093 makes `defineMcpAppResource` own the Model Context Protocol (MCP) App
resource MIME type and fixes it to `text/html;profile=mcp-app`. That default is
appropriate for new MCP App resources, but it prevents an established server
from adopting the helper when its published compatibility contract requires
`text/html+skybridge`.

GitHub issue 102 identifies `home-loan-mcp` as that adopter. Its resource
declaration, returned content, migration test, and published-contract test use
`text/html+skybridge`. Changing the adopter to the modern MIME type would alter
a relied-on public contract rather than complete a compatible migration.

The decision must preserve the modern default, admit only the evidenced legacy
value, and keep one selected value consistent across resource discovery and
resource reads. All other packaging boundaries decided by ADR-0093 remain
unchanged.

## Decision Drivers

- Preserve established public MIME contracts during framework migration, as
  required by confirmed JTBD-005.
- Treat a published MIME type as a checked compatibility surface, as required
  by confirmed JTBD-006.
- Keep `text/html;profile=mcp-app` as the default for existing and new helper
  callers.
- Prevent resource listing and returned content from reporting different MIME
  types.
- Keep the public option narrow enough to test and support without accepting
  arbitrary resource formats.
- Preserve the URI, metadata, access, script-escaping, startup-loading, and
  documentation boundaries already ratified in ADR-0093.

## Considered Options

1. **Checked two-value MIME selection (chosen)** - Keep
   `text/html;profile=mcp-app` as the default and allow a caller to select only
   `text/html+skybridge`; use the selected value for both the resource listing
   and returned content.
2. **Keep the fixed modern MIME type** - Retain ADR-0093 unchanged and require
   established adopters either to change their public contract or to continue
   packaging MCP App resources without the helper.
3. **Accept any caller-supplied MIME string** - Let each caller provide an
   unrestricted value and pass it through to listing and returned content.
4. **Add a separate Skybridge helper** - Preserve the existing helper and add
   another public helper for the legacy MIME contract.

## Decision Outcome

Chosen option: **"Checked two-value MIME selection"**, because it preserves the
modern contract by default while allowing the one evidenced legacy contract to
adopt the existing packaging boundary without a breaking MIME change.

`defineMcpAppResource` will accept an optional MIME selection with exactly this
public contract:

```ts
mimeType?: "text/html;profile=mcp-app" | "text/html+skybridge";
```

Omitting `mimeType` will select `text/html;profile=mcp-app`. An explicit
`text/html+skybridge` will select the legacy compatibility value. No other MIME
value will be accepted, inferred, or normalised.

The selected value will be fixed when the resource definition is created. The
same value will appear in the resource declaration returned through
`resources/list` and every matching content item returned through
`resources/read`.

This decision changes only the MIME selection owned by the helper. ADR-0093's
canonical URI, modern and OpenAI metadata aliases, Content Security Policy,
access controls, checked `defineResource` path, document assembly, script
escaping, startup bundle loading, application ownership, and documentation
boundaries remain in force.

## Consequences

If implemented, this decision will have these consequences.

### Good

- Established Skybridge-compatible servers can adopt the helper without
  changing their published MIME contract.
- Existing callers keep the same result when they omit the option.
- The type boundary and runtime validation reject unsupported MIME values.
- One definition-time value prevents listing and read responses from drifting.

### Neutral

- The public helper gains one optional property and one additional supported
  literal; it does not gain a general content-type extension mechanism.
- Selecting a stored string adds no per-request branch, filesystem access, or
  network access. The default has a zero-byte response delta. The Skybridge
  literal is 19 UTF-8 bytes rather than 25, reducing each affected listing
  entry or content item by 6 bytes.
- No resource-path performance budget currently applies. On the explicit
  no-data worst-case assumption of one listing and one read across 10,000
  sessions per day, the selection adds 0 milliseconds of request-time CPU and
  reduces network payload by 120,000 bytes per day.

### Bad

- Em See Pea accepts a continuing compatibility obligation for a legacy
  OpenAI-specific MIME value.
- A future third MIME contract requires another reviewed decision rather than
  passing through an arbitrary string.
- Tests and documentation must cover both supported values wherever they
  describe the helper's public MIME contract.

## Confirmation

Implementation and delivery require all of these checks:

- Public type checks accept an omitted `mimeType`,
  `text/html;profile=mcp-app`, and `text/html+skybridge`, while rejecting any
  other literal.
- Definition-time runtime checks reject unsupported MIME values received across
  an untyped JavaScript or data boundary.
- Black-box modern and legacy MCP client checks observe
  `text/html;profile=mcp-app` in both `resources/list` and `resources/read` when
  the option is omitted or explicitly modern.
- Equivalent black-box checks observe `text/html+skybridge` in both operations
  when that value is selected.
- Existing URI, metadata, Content Security Policy, access, document,
  script-escaping, startup-loading, example, guide, and package checks continue
  to pass for both supported values where applicable.
- A migration or published-contract check for the evidenced adopter preserves
  `text/html+skybridge` without weakening its existing baseline.
- ADR-0094 must be ratified before implementation begins. Until then, ADR-0093
  remains the authoritative decision and is not replaced.

Passing source, type, and black-box checks confirms only the helper's two-value
contract and listing/read consistency. It does not by itself prove host
rendering, package publication, adopter deployment, or adopter production use;
those outcomes require their own named evidence.

## Pros and Cons of the Options

### Checked two-value MIME selection

- Good, because it preserves both the existing default and the evidenced
  adopter contract with one narrow option.
- Bad, because the framework must support and test a legacy MIME value.

### Keep the fixed modern MIME type

- Good, because it leaves the public helper and ADR-0093 unchanged.
- Bad, because it blocks compatible helper adoption or forces a breaking
  adopter-contract change.

### Accept any caller-supplied MIME string

- Good, because future MIME values would not require an API change.
- Bad, because it expands the helper beyond evidenced MCP App formats and makes
  its compatibility surface open-ended.

### Add a separate Skybridge helper

- Good, because each helper would expose one fixed MIME value.
- Bad, because it duplicates the remaining packaging contract and creates two
  public entry points for one definition-time difference.

## Reassessment Criteria

Reassess this decision if any of these happen:

- The modern MCP Apps specification retires or replaces
  `text/html;profile=mcp-app`.
- Supported hosts no longer require `text/html+skybridge`, and published adopter
  contracts can remove it without a breaking change.
- A third independently evidenced MIME contract cannot use the helper.
- Resource-path measurements show that MIME selection affects performance
  beyond the zero-request-work design assumed here.
