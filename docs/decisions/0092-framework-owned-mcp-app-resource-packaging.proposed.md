---
status: "proposed"
date: 2026-09-15
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: ["GitHub issue 93 customer voice"]
reassessment-date: 2026-12-15
---

# Framework-Owned Model Context Protocol App Resource Packaging

> Captured via `/wr-architect:capture-adr`. The substance was derived from the
> issue, adopter evidence, current specifications, and independent architecture
> and Jobs To Be Done reviews. Human oversight remains pending until Tom
> Howard explicitly ratifies or amends it.

## Context and Problem Statement

Model Context Protocol (MCP) App resources repeat security-sensitive packaging
across adopters and Em See Pea's maintained React example. Each implementation
must:

- align one `ui://` Uniform Resource Identifier (URI) and Multipurpose Internet
  Mail Extensions (MIME) type;
- assemble a complete HyperText Markup Language (HTML) document;
- prevent an inline bundle from ending its script element;
- declare modern resource and Content Security Policy metadata; and
- preserve legacy OpenAI metadata for compatible hosts.

The existing generic `defineResource` and `defineTool` APIs can carry these
contracts, but they deliberately do not own this MCP App-specific assembly.

Issue 38 proved the generic runtime can support MCP Apps. Issue 93 asks whether
the repeated packaging boundary should now become a small public framework
helper without moving application content, behaviour, or build tooling into the
framework.

## Decision Drivers

- Derive resource and tool metadata from one canonical URI.
- Centralise repeated script-embedding and metadata assembly that is easy for
  adopters to get wrong.
- Reuse the existing checked resource registration, authorization, discovery,
  timeout, cancellation, and result-size boundaries.
- Keep application markup, styles, domain data, behaviour, effects, and build
  choice application-owned.
- Keep React, Svelte, Tailwind, browser runtimes, and build tools optional.
- Preserve modern MCP Apps metadata and the existing OpenAI compatibility
  aliases without claiming universal host support.
- Add no dependency or new package for a small server-side transformation.

## Considered Options

1. **One composite server helper (chosen)** - Add `defineMcpAppResource` to
   `@emseepea/server`. It reuses `defineResource` and exposes URI-aligned tool
   metadata from the same definition.
2. **Packaging-only helper** - Build and escape the HTML document while leaving
   resource registration, MIME type, Content Security Policy, and tool metadata
   with every adopter.
3. **Keep the generic APIs only** - Retain the current example and require each
   adopter to continue assembling the contract directly.

## Decision Outcome

Chosen option: **"One composite server helper"**, because one existing
framework boundary can remove the repeated security-sensitive assembly while
leaving the application-specific work outside the framework.

If Tom Howard ratifies this proposal, `@emseepea/server` will add
`defineMcpAppResource`. The helper will return an ordinary `EmseepeaResource`
registration with URI-aligned tool metadata available for a tool definition.
It will call `defineResource` rather than create another registration path.
The existing access, discovery, validation, deadline, cancellation, progress,
logging, and result-size behaviour will remain authoritative.

The definition will require:

- the resource name and access policy;
- a canonical `ui://` URI and title;
- the document language and trusted application-owned body markup; and
- either a built script string or a local bundle file URL.

It will optionally accept:

- a resource description and trusted styles;
- bounded Content Security Policy origins; and
- a border preference.

A bundle file will be read once when the definition is created. Resource reads
will perform no filesystem or network work.

The helper will own only these invariants:

- `text/html;profile=mcp-app` on the resource listing and returned content;
- the same canonical URI on the listing, returned content, modern tool
  `_meta.ui.resourceUri`, and legacy `openai/outputTemplate` metadata;
- modern `_meta.ui.csp` and `_meta.ui.prefersBorder` plus the matching legacy
  `openai/widgetCSP` and `openai/widgetPrefersBorder` aliases;
- a complete HTML5 document with a doctype, escaped language and title,
  viewport metadata, trusted body and style insertion, and case-insensitive
  neutralisation of every inline `</script` sequence; and
- definition-time rejection of malformed or excessive Content Security Policy
  origin declarations.

The helper will not invent a root element, landmark, heading, route, theme,
class, design token, domain message, action, authentication rule, or effect
authority. It will not bundle source, watch files, import a stylesheet, or add
React, Svelte, Tailwind, or an MCP Apps software development kit dependency.
Applications will remain responsible for valid, accessible body markup and
styles, their build output, domain behaviour, and declared external-origin
needs.

The current React example will adopt the helper and delete its duplicated
document, MIME, metadata, Content Security Policy alias, and script-escaping
assembly. Its existing tool and resource fields will remain unchanged. The
helper will add matching static metadata to the resource listing.

Reader guidance will have one maintained source in
`website/src/content/docs/examples.md`. It will explain:

- when to use the helper;
- each input;
- the trusted and validated boundaries;
- startup bundle loading;
- modern and OpenAI compatibility metadata;
- aligned tool metadata; and
- the limits of source, release, website, and adopter evidence.

The
`@emseepea/server` README will provide a concise orientation and descriptive
link instead of copying the guide or its runnable code. The maintained React
example will be the executable source referenced by the guide and exercised by
ordinary and packed-initializer checks.

## Consequences

If ratified and implemented, this decision will have these consequences.

### Good

- Adopters have one checked place to package a self-contained MCP App resource.
- URI, MIME, modern metadata, and OpenAI compatibility aliases cannot drift
  inside a definition.
- Inline bundle escaping and local file loading are implemented and tested once.
- Existing non-UI servers and UI renderers gain no new runtime dependency.

### Neutral

- The helper will add a public API while preserving the generic `defineResource`
  and `defineTool` paths.
- Static modern and legacy UI metadata appears in both resource listing and
  read content so hosts can review it before fetching and obtain the same value
  when they fetch.
- For the maintained empty-Content-Security-Policy fixture, the additional
  resource-list metadata is approximately 186 UTF-8 JSON bytes. Resource reads
  add no response bytes, transient allocation, or per-request file work when
  compared with the existing manually packaged response.

### Bad

- Em See Pea must track changes to both the MCP Apps resource contract and the
  retained OpenAI aliases.
- Trusted body markup and styles can still create an inaccessible or unsafe
  application if an adopter supplies unsuitable content.
- The public definition surface must remain narrow as hosts add optional UI
  metadata that not every adopter needs.

## Confirmation

If ratified, implementation and delivery will require all of these checks:

- Public type checks must accept public and protected definitions and reject mixed
  access forms.
- Definition tests must reject a non-`ui://` URI, malformed Content Security Policy
  origins, excessive origin lists, and definitions that provide both or neither
  of the supported script sources.
- A black-box modern and legacy client check must observe one URI and the MCP Apps
  MIME type across listing, resource read, and tool metadata.
- The resource listing and read content must carry equivalent modern and legacy
  Content Security Policy and border metadata.
- A mixed-case inline `</script` fixture must not end the generated script
  element, while language and title are HTML-escaped.
- The maintained React example must use the helper and retain its browser,
  keyboard, focus, status, contrast, reflow, and host-lifecycle checks.
- The canonical website guide must document the inputs, trust boundary,
  metadata compatibility, startup behaviour, and evidence limits. Its runnable
  path must use the maintained React example and pass the guide and
  packed-initializer checks.
- The `@emseepea/server` README must link to the canonical guide without
  duplicating its runnable snippet.
- Changed public guidance must pass cognitive-accessibility and voice-and-tone
  review bound to the reviewed content.
- Package, packed-initializer, exact-commit continuous integration, publication,
  anonymous registry, website, and adopter production evidence must remain
  reported separately.

## Pros and Cons of the Options

### One composite server helper

- Good, because one URI and one resource definition drive every invariant.
- Bad, because the framework accepts a durable MCP App compatibility surface.

### Packaging-only helper

- Good, because it adds less public API than the composite helper.
- Bad, because every adopter can still drift on MIME, Content Security Policy,
  and tool-resource linkage.

### Keep the generic APIs only

- Good, because the framework adds no API or compatibility obligation.
- Bad, because the repeated adopter code and security-sensitive assembly named
  by issue 93 remain unresolved.

## Reassessment Criteria

Reassess if any of these happen:

- The MCP Apps extension makes the current MIME type or metadata shape obsolete.
- OpenAI compatibility aliases are retired.
- A maintained build tool can own bundle discovery without coupling the server
  package to a bundler.
- Adopters need dynamic per-read documents rather than one startup-built
  resource.
- Measured resource-list overhead needs a dedicated performance budget.
