---
status: "proposed"
date: 2026-08-31
human-oversight: confirmed
oversight-date: 2026-08-31
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-30
---

# Static-Only Website Runtime

## Context and Problem Statement

Readers need guides and examples. The initial website does not need a running
application server, database, or account system.

## Decision Drivers

- Keep operation simple.
- Make reading independent of application services.

## Considered Options

1. **Static files** - Generate pages during the build.
2. **Server-rendered application** - Generate responses using a running server.

## Decision Outcome

Chosen option: **"Static files"**, because the initial website does not need application services.

Publish static files only. Do not add a server adapter, server-side rendering,
API routes, database, sign-in, or runtime secrets.

Analytics, cookies, and interactive documentation components are not requested
and stay outside the initial scope. Pages must remain useful without client-side
JavaScript, even though optional features such as search may use it.

## Consequences

### Good

- Reading does not depend on an application server.

### Neutral

- Content changes require a new static build.

### Bad

- A future feature that genuinely needs server behavior requires reassessment.

## Confirmation

- Build output can be served as static files without an application process.
- The site has no server adapter, API route, runtime secret, analytics, or cookies.
- Core guide content and navigation remain usable with JavaScript disabled.

## Pros and Cons of the Options

### Static files

- Good: Small operational surface.
- Bad: Content updates require rebuilding.

### Server-rendered application

- Good: Supports dynamic server features.
- Bad: Adds infrastructure without a current need.

## Reassessment Criteria

Revisit when an accepted reader need cannot be met with static files.

## Related Decisions

- [github pages website hosting](0033-github-pages-website-hosting.proposed.md)
