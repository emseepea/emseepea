# Battle Plan: Build Em See Pea

Last updated: 2026-08-31

This is an implementation plan designed to change when evidence shows a better
route. It keeps the objective, boundaries, proof, and next decision clear.

## Objective

Build and independently check a reusable, monorepo-based Model Context Protocol
(MCP) `2026-07-28` server framework over Streamable HTTP.

The finished product must provide:

- opt-in server capabilities
- no-UI, native UI, React UI, streaming, and multi-instance examples
- accessible native controls and forms
- small public packages with little adopter boilerplate
- approved open-source dependencies under the MIT licence
- a comprehensive documentation website whose guides and examples are checked
  against the current release
- exact, honest capability claims while work is incomplete
- a full active server-surface claim only after complete clean-checkout proof

Do not build a custom cryptographic certification system.

## Current Position

Already implemented and checked in earlier revisions:

- basic tools through the real Fastify HTTP boundary
- public discovery and tool listing
- tools that require sign-in while discovery remains public
- separate public and backend data checks with explicit mapping
- public resources, resource patterns, prompts, and suggestions
- bounded progress updates for local POST requests
- native and React form renderers with a separate Tailwind package
- native and React UI examples using the same form contract
- a two-process SQLite example for one-computer deployments
- deterministic tests and lint commands owned by every runnable example

New source work passed Node.js 22 and 24 CI: public tools can send bounded
progress through a trusted proxy, with each request handled by one of two
independent server processes. This is not yet published to npm. See the
[progress coverage and limits](docs/protocol-coverage.md#progress-updates).

Current next action:

1. Decide
   [ADR-0029: Code-First Semantic Tests](docs/decisions/0029-code-first-semantic-tests.proposed.md).
2. If ratified, replace the remaining YAML language-model cases with code-first
   tests.
3. Then close the partial and missing rows in the
   [MCP server coverage ledger](docs/protocol-coverage.md).

The documentation website remains required. Plain-language review and
language-model understanding checks continue for every example.

## Definition of Victory

The objective is complete only when all of these statements have current
evidence:

1. The public MCP specification and official schemas are pinned and traced to
   tests.
2. Public packages are versioned, installable, and limited to proven APIs.
3. Every optional capability is absent when disabled and accurately advertised
   when enabled.
4. Invalid input, failed sign-in, or missing permission causes no application,
   adapter, network, or data-changing call.
5. Public MCP results never expose private backend types, credentials,
   destinations, or unsafe errors.
6. Deadlines, cancellation, memory, queues, output sizes, shutdown, and log
   redaction have negative tests.
7. Native and React UI paths pass Web Content Accessibility Guidelines (WCAG)
   2.2 AA checks, keyboard testing, and screen-reader testing.
8. No-UI, UI, streaming, and multi-instance examples run from clean checkouts
   using only public packages.
9. Two unrelated services and two different backend adapters need no framework
   special cases.
10. Two independent MCP clients work through the public HTTP boundary.
11. The documentation website checks links, code, commands, examples,
    accessibility, and release freshness.
12. Complete active server coverage is proven before the full-surface claim is
    made.

## Non-Negotiable Boundaries

- Use maintained open-source dependencies before custom infrastructure.
- Keep public MCP data separate from backend data and credentials.
- Validate input before mapping, backend input before calling, backend output
  before mapping, and the final public result before returning it.
- Keep Fastify request and reply objects at the HTTP boundary.
- Keep React and Tailwind out of the core server package.
- Use native HTML controls before custom widgets.
- Keep authorization and approval decisions on the server.
- Never weaken validation, security, cancellation, accessibility, or data-loss
  protection to meet a schedule.
- Add shared state only when a capability needs a cross-instance guarantee.
- Add a second transport only when there is a real accepted use case.
- Describe unproven behavior as not included.

## Work Loop

For each increment:

1. Choose the highest-value outcome or highest-risk unknown.
2. State what adopters will be able to do and where it is safe to run.
3. Remove work that does not help that outcome.
4. Implement through the real HTTP boundary.
5. Check success, disabled behavior, invalid input, cancellation, and resource
   limits.
6. Run the example with an independent MCP client.
7. Check whether a language model understands the returned information.
8. Review architecture, security, accessibility, and public wording.
9. Commit and push the exact proven claim.
10. Update this plan when evidence changes the route.

## Delivery Priorities

### 1. Close the Semantic-Testing and Coverage Decisions

- ratify or reject the code-first semantic-testing decision
- migrate the example tests only if that decision is ratified
- keep every example independently copyable, testable, and lintable
- maintain the active protocol coverage ledger from public sources and exact
  tests

### 2. Complete Production Boundaries

- trusted proxy and authority checks
- production-ready token verification guidance
- record-level and organisation-level authorization hooks
- one framework-owned outbound HTTP policy before any external API example
- request, response, redirect, address, and size limits for outbound calls
- redacted logging and telemetry-failure isolation

### 3. Extend Streaming Only When Bounded

- prove progress ordering and final-result agreement
- prove slow-reader, disconnect, timeout, and queue-overflow behavior
- test through a real proxy before claiming production streaming
- add replay, sessions, or subscriptions only for an accepted use case

### 4. Add Multi-Instance Operation

- prove the single-instance race first
- choose shared state only for the capability that needs it
- alternate requests between at least two instances
- prove at most one continuation or data-changing action
- make a failed shared provider disable only the dependent capability
- keep an honest single-instance profile

### 5. Build the Documentation Website

- record the generator, hosting, dependency, and publication decision first
- provide getting-started paths for no-UI, UI, streaming, and multi-instance use
- generate or check public API reference from package exports
- run every documented command and example from a clean checkout
- check links, code blocks, accessibility, mobile layout, and release freshness
- never present unreleased behavior as current

### 6. Prove the Full Active Server Surface

- turn every active server method and lifecycle rule into observable checks
- verify enabled, disabled, invalid, cancellation, and resource-bound behavior
- repeat with two independent clients
- repeat from two clean checkouts
- obtain independent architecture, security, accessibility, and performance
  reviews
- revise the full-surface claim only when no required evidence is missing

## Decision Gates

Stop and record a decision before changing:

- the pinned protocol baseline
- a released public API
- package boundaries
- the core language or runtime
- the approved licence set
- security or authorization rules
- the shared UI contract
- the shared-state provider
- the transport set
- the release scope

## Recovery Responses

When reality contradicts the plan:

- If public MCP sources disagree with an assumption, stop that feature, create a
  raw request example from public sources, and update the acceptance test.
- If an official dependency emits incompatible behavior, contain it at the
  boundary or replace it. Do not maintain a private fork by default.
- If an example needs a private escape hatch, fix the public package once and
  remove the exception.
- If streaming can grow without a bound, withdraw the streaming claim and keep
  the proven JSON path.
- If sign-in cannot prove issuer, audience, permission, and token separation,
  stop tools that require sign-in while keeping proven public tools available.
- If shared state cannot prove atomic behavior, retain single-instance support
  and remove the multi-instance claim.
- If a UI renderer creates accessibility or authorization risk, retain the
  shared native contract and withdraw that optional renderer.
- If a dependency becomes unsafe, abandoned, or licence-incompatible, replace
  it behind its narrow boundary.
- If performance misses a placeholder, profile first and set a measured adopter
  budget. Do not remove safety checks blindly.

## Evidence Rules

Every example must include:

- one start command
- one documented safety and deployment boundary
- one successful call through the public HTTP endpoint
- one relevant invalid or denied request
- one independent MCP client check
- sample data that contains no private information
- three fresh language-model answers and three independent judgments
- fixed facts that the answers must understand
- proof of the exact MCP operation that supplied the information
- a clean-checkout run

Every public document changed in a release receives cognitive-accessibility and
Markdown accessibility review. Automated paragraph checks are regression
signals, not proof that people will understand the content.

## Authoritative Records

- [Architecture decisions](docs/decisions/README.md)
- [MCP server coverage](docs/protocol-coverage.md)
- [Quality policy](QUALITY.md)
- [Risk register](docs/risks/README.md)
- [Current release readiness](docs/reviews/0.0.2-release-readiness.md)
- [Framework package guide](packages/framework/README.md)

These records hold detail so this battle plan can remain a usable decision aid.
