---
status: "proposed"
date: 2026-09-09
human-oversight: confirmed
oversight-confirmed-date: 2026-09-09
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
supersedes: [0018-public-discovery-and-invocation-scoped-oauth-security]
reassessment-date: 2026-12-09
---

# Typed Authentication with Optional Permission-Shaped Discovery

## Context and Problem Statement

Authentication is independent of whether an MCP server uses a database, web
API, SOAP service, UI, or another application shape. Separate initializers for
every functional and security combination force users to choose between useful
features and create an expanding matrix of duplicated templates.

MCP discovery should normally remain open so clients can understand a server
before authenticating. Some teams nevertheless need to protect discovery and
show different capabilities to principals with different permissions. The
framework must support both choices without weakening authorization at
invocation time.

## Decision Drivers

- Keep initializers focused on application shape rather than authentication.
- Show open and protected use in every maintained initializer.
- Preserve public discovery as the safe and interoperable default.
- Allow explicit protected discovery when an operator requires it.
- Allow a protected catalogue to vary by normalized principal permissions.
- Apply one access model to tools, resources, templates, prompts, and
  completions.
- Authenticate and authorize before application or backend work.
- Keep tokens and raw provider claims outside capabilities and observability.
- Avoid unrestricted middleware that can bypass the checked request kernel.

## Considered Options

1. **Typed authentication with optional permission-shaped discovery**: provide
   one framework-owned authentication slot, keep discovery public by default,
   and allow an explicit protected mode that filters the compiled catalogue
   using static access policy and normalized permissions.
2. **Always-public discovery with protected invocation only**: retain the
   current model and require every protected capability to remain visible.
3. **Protect the entire MCP endpoint whenever authentication is configured**:
   make discovery and invocation share one blanket authentication rule.
4. **Generic middleware plugins**: let arbitrary middleware authenticate,
   filter, or replace capabilities at request time.

## Decision Outcome

Chosen option: **"Typed authentication with optional permission-shaped
discovery"**, because it keeps the common open-discovery experience simple
while supporting teams whose catalogue is itself protected information.

`createEmseepea` has one typed authentication extension slot. An authentication
adapter verifies credentials and returns a normalized principal containing
only stable identity and permission fields that the framework defines. It does
not pass bearer tokens, provider claims, or provider errors to handlers,
capabilities, public results, or observability adapters. Duplicate
authentication extensions fail during startup.

Discovery remains public by default. In that mode, unauthenticated clients can
discover the server and list the public contracts for open and protected
capabilities. Protected invocation still requires the declared permissions.
The permission filter applies only when protected discovery is explicitly
selected. OAuth protected-resource metadata and authorization-server discovery
metadata remain public in both modes so clients can learn how to authenticate.

An operator may explicitly select protected discovery. Missing or invalid
credentials then fail before catalogue construction. The visible catalogue is
a pure deterministic view of the immutable startup-compiled registry. It uses
only the normalized principal permissions and static capability access policy.
Filtering performs no input/output, reads no clock or random state, and runs no
caller-selected code. It preserves stable ordering. Pagination cursors are
bound to the filtered catalogue and cannot cross permission views. Responses
that depend on identity are private and non-cacheable.

Every tool, resource, resource template, and prompt declares an explicit open
or protected access policy. Completion inherits the access policy of its
referenced prompt or resource template. Access policy always controls direct
execution and filters catalogue results only in explicitly protected-discovery
mode. A capability omitted from a principal's catalogue also fails closed when
called directly. Its response is indistinguishable from an unknown capability
and reveals no hidden name, schema, required permission, or OAuth challenge.
Authentication and authorization finish before handlers, availability checks,
completion callbacks, or backend calls.

Em See Pea remains an OAuth resource server, not an authorization server or
dynamic client-registration service. The configured verifier validates issuer,
audience, expiry, intended resource, and required permissions. The provider is
selected by the operator, never the caller. Caller bearer tokens are never
reused as backend credentials.

Existing outbound-request protections remain mandatory. Destinations use fixed
allowlists and safe URL parsing. Redirects are bounded and revalidated. DNS and
resolved addresses are checked against prohibited ranges for every connection,
including after resolution changes. Response status, headers, duration, and
body size remain bounded before data crosses the public result boundary.

Each maintained initializer remains the only template source for its
application shape. Its generated runnable source and automated tests
demonstrate both open and protected composition, and its README explains when
to use each mode. This does not copy an authentication implementation or create
a second template tree. The dedicated sign-in initializer becomes redundant
and is removed from the canonical package list, documentation, website, and
release workflow. All of its published npm versions are deprecated in favour
of the general tool initializer.

Protected discovery receives no performance claim until measured under a
pinned reproducible profile with a stated percentile. The existing whole-path
performance decision explicitly excludes OAuth. Framework authentication adds
no network call of its own. Any network work performed by a verifier belongs to
that adapter and is separately bounded.

## Consequences

### Good

- Users can combine authentication with any initializer.
- The ordinary anonymous discovery journey remains unchanged.
- Teams can protect catalogue information and vary services by permission.
- Direct invocation cannot bypass catalogue filtering or access policy.
- One normalized security boundary works across all MCP capability types.

### Neutral

- Adopters still choose and operate a compatible authorization provider.
- Open and protected composition appear in documentation and tests rather than
  as separate initializer packages.
- Identity-specific catalogues cannot use shared public caches.

### Bad

- Permission-shaped discovery requires principal-bound pagination and more
  security tests.
- A protected catalogue is harder for clients to inspect before sign-in.
- The current authentication and access API must change during the pre-alpha
  period.

## Confirmation

- With no authentication extension, every maintained initializer starts in
  open mode and its discovery, listing, and invocation tests pass.
- Every maintained initializer documents and tests adding the same protected
  authentication composition without maintaining a second template tree.
- Public discovery remains the default when protected capabilities exist.
- Default public discovery lists the public contracts for both open and
  protected capabilities. Permission filtering occurs only in explicitly
  protected-discovery mode.
- OAuth protected-resource and authorization-server discovery metadata remain
  public in both discovery modes.
- Explicit protected discovery rejects missing or invalid credentials before
  constructing a catalogue.
- Two principals with different normalized permissions receive the exact
  expected deterministic catalogues with stable ordering.
- Pagination cursors cannot be reused across different permission views.
- A capability hidden from a principal fails closed when called directly.
- Hidden and unknown direct calls have the same safe public error and cause zero
  handler, availability, completion, and backend calls.
- Open and protected capabilities coexist in one server.
- Tools, resources, templates, and prompts receive identical discovery and
  invocation enforcement. Completion inherits the policy of its referenced
  prompt or resource template.
- Missing permissions cause zero handler, availability, completion, or backend
  calls.
- Tokens, credentials, raw claims, and provider errors never reach handlers,
  logs, public results, or observability adapters.
- Invalid issuer, audience, expiry, intended resource, or permissions cause
  zero application and backend calls.
- The authentication provider is operator-configured, Em See Pea does not act
  as an authorization server, and caller credentials are never backend
  credentials.
- Outbound-request tests retain fixed destinations, safe parsing, redirect and
  DNS revalidation, prohibited-address rejection, and bounded response checks.
- Duplicate authentication configuration and unenforceable access policy fail
  at startup.
- `@emseepea/create-sign-in-tool-server` is removed from the canonical package
  list and all of its published versions are deprecated in favour of
  `@emseepea/create-tool-server`.
- READMEs, the website, standalone initializer qualification, semantic
  evaluation, software bills of materials, provenance, registry checks, and
  exact-release checks cover the new composition model.
- Native semantic tests prove, without extra model hints, that principals with
  different permissions are offered and select only their visible
  capabilities.
- A pinned profile and percentile accompany measured protected-discovery
  evidence before any protected-path performance claim is published.

## Pros and Cons of the Options

### Typed Authentication with Optional Permission-Shaped Discovery

- Good: Supports open and protected catalogue policies without duplicating
  templates or moving security into application handlers.
- Bad: Adds a filtered-catalogue path that must remain deterministic and
  independently authorized.

### Always-Public Discovery with Protected Invocation Only

- Good: Gives every client one stable catalogue before sign-in.
- Bad: Cannot serve teams that treat capability availability as protected
  information.

### Protect the Entire MCP Endpoint Whenever Authentication Is Configured

- Good: Is simple to describe as one endpoint rule.
- Bad: Makes the uncommon protected-discovery choice the default and prevents
  normal pre-authentication discovery.

### Generic Middleware Plugins

- Good: Allows arbitrary integration code.
- Bad: Makes authentication order, capability filtering, and fail-closed
  guarantees impossible for the framework to enforce.

## Reassessment Criteria

Reassess if MCP standardizes permission-shaped discovery, normalized principal
semantics, or catalogue-bound pagination in a way that conflicts with this
model, or if measured filtering cost exceeds a subsequently adopted budget or
makes the design unsuitable.
