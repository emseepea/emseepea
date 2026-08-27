# Battle Plan: Operation Clean Current

## Status

- Last updated: 2026-08-28
- Document type: Living implementation battle plan.
- Current state: No-user-interface, OAuth, mapped-adapter, resources, prompts,
  completion, loopback streaming, and protected-example slices have the exact
  deterministic quality evidence recorded below.
- Current block: Published-content risk R001 remains outside appetite.
- Next action: Remediate the published-content baseline, then implement the
  ratified optional user-interface packages and examples.
- Release rule: Do not publish `@emseepea/server@0.0.1` under `next` until the
  exact publishing commit passes every quality, semantic, risk, architecture,
  accessibility, and release gate.

This plan is a decision aid, not a contract with yesterday's assumptions.
The objective and rules remain fixed. The route changes when evidence reveals
a shorter, safer, or more useful path.

## Mission

Implement and independently qualify a monorepo-based universal Model Context
Protocol (MCP) `2026-07-28` Streamable Hypertext Transfer Protocol (HTTP) server
framework. Use public specifications and approved open-source dependencies.
Provide working examples without a user interface, with a user interface (UI),
with streaming, and with distributed operation.

The objective is a useful, safe, reusable framework.

Full-profile conformance is earned only when the complete active server surface
is proven. The objective does not require a particular sequence, package graph,
or number of releases.

## Commander's Intent

### Purpose

Make correct and secure MCP server development boring across unrelated domains,
backends, deployment platforms, and telemetry systems.

### Center of Gravity

Maintain one thin adopter path through the real HTTP boundary.

Every capability must strengthen or extend that path without making ordinary
services carry unused complexity.

### End State

- Two unrelated synthetic services use the same public framework application
  programming interface (API) without kernel changes.
- Two materially different adapters preserve identical protocol, security,
  error, cancellation, and observability behaviour.
- At least two independent MCP clients interoperate through the public HTTP
  boundary.
- Capability modules can be enabled independently and advertise only proven
  behaviour.
- Working examples cover basic no-UI, backend, protected, resources and prompts,
  streaming and progress, subscriptions, native and React elicitation and
  approval UI, and multi-instance operation.
- Example directories exist only when their capability works.
- Security, accessibility, performance, and operational checks pass from clean checkouts.
- Release claims name the exact supported modules and deployment boundaries.
- No bespoke cryptographic certification system has been built.
- A comprehensive documentation website presents only verified-current APIs,
  examples, commands, capabilities, and deployment boundaries.

## Definition of Victory

The implementation objective is achieved when all of the following are true:

1. The public MCP baseline is pinned. The official schema is verified. The
   implementation traces back to both.
2. The framework ships as a stable, versioned product. Its public API is small,
   and capabilities are opt-in.
3. Every claimed capability has applicable positive, disabled, negative,
   cancellation, and resource-bound evidence.
4. Discovery exactly matches compiled and observable behaviour.
5. Invalid, unauthenticated, or unauthorized requests cause zero handler,
   adapter, upstream, or effect calls.
6. Backend types, credentials, destinations, and unsafe errors never cross
   public MCP boundaries.
7. Adversarial checks cover deadlines, cancellation, bounded memory and queues,
   backpressure, shutdown, and redaction.
8. Native and React UI examples pass Web Content Accessibility Guidelines
   (WCAG) 2.2 AA, keyboard-only, and screen-reader acceptance.
9. All examples run from a clean checkout. They use published framework APIs
   and synthetic data.
10. Two unrelated services, two adapters, and two independent clients pass
    without kernel special cases.
11. Reproducible builds, ordinary checksums, dependency integrity, software
    bills of materials, continuous integration (CI) evidence, and independent
    reviews support the exact release claim.
12. The documentation website passes freshness, accessibility, link, code, and
    clean-checkout example checks.

## Rules of Engagement

These rules do not yield to schedule pressure.

### Engineering Boundary

- Prefer maintained open-source dependencies. Do not build bespoke protocol,
  schema, OAuth, telemetry, cryptography, accessibility, or test infrastructure.
- Use native platform features and standard libraries before additional dependencies.
- Keep one production framework package by default. Split only for an optional
  dependency, independent consumer, or separate release lifecycle.
- Do not add a generic transport abstraction until a second transport is both
  approved and implemented.
- Keep public MCP contracts separate from private handlers, adapters,
  credentials, policies, and backend models.
- Application code never writes raw HTTP, JSON Remote Procedure Call
  (JSON-RPC), or Server-Sent Events (SSE) responses.
- Advertise a feature only after its enabled, disabled, and negative paths pass.
- Label unproven scope as JSON-only, read-only, anonymous, single-instance, or
  non-streaming. Fail closed beyond that boundary.

### Safety Boundary

- Security controls, validation, cancellation, accessibility, and data-loss prevention are never traded for schedule.
- Sensitive effects remain application-owned unless a proven cross-service need justifies framework support.
- UI contracts and approval authority remain server-owned. Optional React and
  Tailwind packages implement the ratified accessible UI boundary without
  adding frontend dependencies to core.
- Custom release trust roots, run challenges, historical signature graphs, and other bespoke certification machinery remain excluded.

## Battlefield Assessment

### Known Ground

- The universal framework itself is the product.
- The implementation will use a monorepo.
- The first production package will contain the framework; conceptual components begin as internal modules.
- Executable examples are acceptance assets, not marketing decoration.
- The full protocol surface is a strategic target delivered through opt-in modules.
- The guide's 110 outcomes are a coverage ledger, not immutable marching orders or 110 releases.
- Open-source dependencies are expected and preferred.
- The selected stack is TypeScript on Node.js 22 and 24, npm workspaces with one
  root lockfile, Fastify 5, official MCP packages, Zod, MIT licensing,
  Changesets, and npm trusted publishing.
- UI support will use shared accessible fixtures and states, native semantic
  HTML, optional `@emseepea/react`, and one precompiled
  `@emseepea/tailwind` stylesheet.
- Core has no React, React DOM, or Tailwind dependency.
- Approval authority remains server-owned, authenticated, scoped, single-use,
  replay-safe, and atomic.

### Unverified Ground

- Whether every method, header, result type, error mapping, and lifecycle claim in the guide matches the pinned public MCP baseline.
- Whether the official software development kits (SDKs) can cover the remaining
  active server surface without a maintained private fork.
- The smallest public API that works across two unrelated domains.
- Real client interoperability, intermediary behaviour, performance budgets, and state-provider requirements.
- Whether complete active-surface coverage is supportable by two independent clients.
- Which shared-state provider, if any, can prove the required multi-instance
  race semantics.
- Which website generator, host, dependencies, and publication workflow should
  be adopted.

### Principal Threats

- Protocol drift or incorrect assumptions presented as conformance.
- Architecture expanding faster than adopter evidence.
- Framework abstractions built around one implementation.
- Client or intermediary incompatibility hidden by in-process tests.
- Security surface expanding faster than negative testing.
- Streaming and distributed state creating unbounded or ambiguous behaviour.
- Dependency abandonment, vulnerability, incompatible licensing, or private-fork pressure.
- UI accessibility treated as late polish.
- Examples rotting or using private escape hatches.

## Manoeuvre Doctrine

Every increment follows this loop:

```text
Observe
  -> choose the highest-value or highest-risk unknown
  -> define one adopter-visible outcome and deployment boundary
  -> remove everything not required for that outcome
  -> implement through the real HTTP boundary
  -> prove positive, disabled, negative, cancellation, and clean-checkout paths
  -> inspect evidence from real dependencies and clients
  -> update the plan and decisions
  -> release the exact proven claim or hold position
```

Parallel work is allowed when dependencies are independent. Reordering is expected when evidence changes. Safety dependencies may not be bypassed.

Every completed manoeuvre leaves:

- one runnable adopter example;
- one independent-client or raw-wire smoke check;
- relevant zero-application-call negative checks;
- accurate discovery and disabled-capability behaviour;
- bounded resources, deadlines, and cancellation;
- an explicit deployment boundary;
- all earlier applicable checks passing; and
- updated dependency, release-evidence, and decision records.

## Lines of Effort

### Public Protocol Truth

Objective: establish the authoritative wire contract and keep it ahead of implementation assumptions.

Evidence:

- pinned public specification and official schema;
- pinned public authorities and dependency licence records;
- requirement-to-test traceability for the currently claimed surface;
- approved clarifications expressed as observable acceptance scenarios; and
- raw request and response fixtures created independently from public sources.

### Adopter Experience

Objective: maintain one small public API that works for unrelated services.

Evidence:

- examples import only published APIs;
- no example relies on private escape hatches;
- a new service can define and run a capability without kernel changes; and
- package splits occur only when an independent consumer or dependency boundary exists.

### Protocol Kernel

Objective: deliver deterministic codec, dispatch, checked output, context, limits, deadlines, cancellation, discovery, and opt-in modules.

Evidence:

- raw HTTP and independent-client calls through the real endpoint;
- invalid input invokes no application code;
- handlers cannot construct protocol responses; and
- compiled and observed capabilities agree.

### Production and Security

Objective: support real intermediaries, protected services, upstream dependencies, and effects without credential, policy, or data leakage.

Evidence:

- production HTTP, Origin, authority, proxy, and limit checks;
- one proven OAuth mode before alternate modes;
- object and tenant authorization tests;
- token separation and server-side request forgery (SSRF) controls;
- redaction and telemetry-failure isolation; and
- zero-call or zero-effect denials.

### Streaming and State

Objective: provide request Server-Sent Events, progress, subscriptions,
elicitation, and bounded state with explicit terminal semantics.

Evidence:

- real-intermediary streaming tests;
- slow-reader, disconnect, expiry, cancellation, and queue-overflow tests;
- validated events followed by one validated final result;
- documented close-and-resynchronise behaviour; and
- no implied replay or session semantics.

### Distributed Operation

Objective: add shared state only to capabilities that need cross-instance guarantees.

Evidence:

- local behaviour passes before shared behaviour begins;
- alternating-instance races produce at most one continuation or effect;
- provider failure fails the dependent capability closed; and
- single-instance profiles remain available and truthful.

### Qualification and Release

Objective: accumulate ordinary interoperability and safety evidence throughout
delivery. Aggregate it only when seeking the full claim.

Evidence:

- exact module claims;
- clean-checkout CI;
- locked dependencies, checksums, and software bills of materials;
- deterministic reports without custom certification protocols;
- three fresh Promptfoo agent trials and three independent judge verdicts for
  every example, with deterministic facts and exact MCP path evidence;
- two unrelated services, two adapters, and two clients; and
- protocol, security, architecture, accessibility, and performance reviews.

### Documentation Website

Objective: keep comprehensive public guidance synchronized with the framework
that adopters can actually install.

Evidence:

- version-labelled getting-started paths for every supported adopter profile;
- public API, capability, configuration, security, and deployment reference;
- runnable no-UI, UI, streaming, and multi-instance examples as each becomes qualified;
- generated or checked public-export reference with no undocumented public API drift;
- clean-checkout execution of documented commands, snippets, and examples;
- automated broken-link, HTML, code-block, static-type, and claim checks; and
- WCAG 2.2 AA automation plus keyboard and screen-reader acceptance.

## Default Advance Route

This route is the current best hypothesis.

Only these dependencies are fixed:

- kernel before modules
- request state machine before streaming
- authentication before protected effects
- local correctness before distributed state

### Objective 0: Establish the Battlefield

Status: completed on 2026-08-27.

Actions:

- Treat the guide's 110 outcomes as a coverage ledger and exclude its rejected
  certification system from the full claim.
- Verify the public MCP baseline, especially discovery, mirrored headers, header projection, result types, error codes, and deprecated features.
- Resolve the known guide contradictions as acceptance scenarios.
- Choose the runtime, package manager, MCP SDK, schema validator, licence, dependency policy, and provisional measurable budgets.
- Record the minimum architecture decisions.

Exit evidence at the checkpoint:

- the public baseline, selected stack, claim model, and first raw-wire corpus agree;
- no runtime package had been released at that checkpoint; and
- the implementation boundary is ready.

### Objective 1: Win the No-UI Beachhead

Status: completed on 2026-08-27 for the exact JSON and invocation-scoped OAuth
slice described in the repository README. Broader universal-framework work
remains active.

Create only:

```text
packages/framework/
examples/basic-no-ui/
tests/black-box/
protocol/
docs/
```

Deliver:

- loopback, JSON, stateless `POST /mcp`;
- required discovery, tool listing, and tool calling;
- bounded parsing and schema validation;
- checked text and structured object results;
- safe error layers;
- deadlines, disconnect cancellation, limits, health, and shutdown; and
- one synthetic read-only tool.

Exit signal:

- raw HTTP and one independent client call the tool from a clean checkout;
- malformed and unauthorized requests invoke no handler; and
- adding breadth before this signal is prohibited.

### Continuous Objective: Publish Verified Documentation

Begin after the first public package exists and expand only with qualified
capabilities.

Deliver:

- a comprehensive, version-labelled documentation website;
- short getting-started paths for each supported deployment and UI profile;
- public API, configuration, security, capability, and deployment reference;
- runnable examples that import only released public packages;
- code and command snippets checked against the current package; and
- accessible navigation, search, content, examples, and status messaging.

Exit signal for each release:

- the documented install and getting-started paths pass from a clean checkout;
- public exports, examples, links, code blocks, and capability claims match the
  released version;
- unreleased or unqualified behaviour is not presented as current; and
- automated WCAG 2.2 AA checks plus keyboard and screen-reader acceptance pass.

Choose the site generator, hosting platform, dependencies, and publishing
workflow only immediately before implementation, under a recorded decision.
If automated deployment is selected, that decision must explicitly amend the
current prohibition on repository deployment workflows.

### Objective 2: Hold Production Ground

Deliver:

- production authority, Origin, proxy, HTTPS, configuration, rate-limit, readiness, shutdown, and redaction behaviour;
- one real backend boundary with independent input and output validation;
- two materially different synthetic adapters; and
- one production OAuth resource-server mode, followed by alternate modes only when separately justified.

Examples:

- `backend-no-ui`;
- `protected-no-ui`.

Exit signal:

- both adapters preserve the same MCP contract without kernel changes;
- invalid credentials or authorization produce zero backend calls; and
- telemetry failure does not alter the client response.

### Objective 3: Expand Non-Streaming Capability

Pull the next capability by verified adopter constraint, not document order:

- structured output and common content;
- resources and templates;
- prompts;
- completion;
- pagination; and
- private cache hints.

Example:

- `resources-prompts`.

Exit signal:

- every advertised capability has a positive independent-client check;
- every disabled capability is absent and safely rejected; and
- unauthorized catalogue entries remain undisclosed.

### Objective 4: Open the Streaming Front

First prove one loopback-only, POST-scoped progress path:

- checked event emission during execution;
- one checked final result;
- cancellation and disconnect;
- bounded event count and size;
- authentication before streaming; and
- JSON fallback when progress is not requested.

Do not add heartbeats, replay, sessions, subscriptions, intermediaries, or
distributed state to this first slice. Add each only for an accepted use case
with its own terminal and resource-bound evidence.

Examples:

- `streaming-progress`;
- `subscriptions` only when that later capability begins.

Exit signal:

- JSON and SSE final semantics agree;
- slow clients terminate predictably without unbounded buffering; and
- no replay or session guarantee is implied.

### Objective 5: Add Human Interaction and Effects

Deliver in dependency order:

- form and URL elicitation;
- bounded low-risk writes;
- application-owned transactions;
- idempotency only where effects require it;
- server-controlled authenticated approval; and
- shared atomic state only when the multi-instance variant begins.

Examples:

- `elicitation-ui`;
- `approval-ui`.

UI posture:

- share canonical, presentation-safe fixtures and states across native and React
  renderers;
- use native controls and forms before custom widgets;
- publish optional `@emseepea/react` unstyled semantic renderers;
- publish one precompiled `@emseepea/tailwind` stylesheet with no adopter
  Tailwind configuration;
- keep frontend dependencies out of core; and
- keep authenticated approval authority on the server.

Exit signal:

- navigation consent never authorizes an effect;
- confirm, decline, cancel, expiry, alteration, replay, concurrency, and CSRF paths pass;
- keyboard-only and screen-reader users can complete every path; and
- WCAG 2.2 AA checks pass.

### Objective 6: Scale and Qualify

Deliver:

- shared providers only for proven cross-instance needs;
- a `multi-instance` example;
- compatibility classification and migration guidance;
- extension negotiation with one synthetic extension;
- complete current-profile negative coverage;
- two unrelated services, two adapters, and two independent clients; and
- two reproducible clean-checkout runs plus independent reviews.

Exit signal:

- cross-instance races produce at most one continuation or effect;
- provider failure makes the dependent capability unready and fails closed; and
- the exact revised full-profile claim is supported without bespoke certification machinery.

## Decision Gates

### Source-Authority Gate

Confirm the pinned public schema and wire behaviour before implementing affected
features.

If the public baseline contradicts the guide, amend the guide first.

### First Operating-Capability Gate

One loopback read-only tool must support discovery, listing, and calling through
raw HTTP and an independent client before breadth begins.

### Dependency Gate

Use a maintained compatible open-source library unless a black-box probe proves
it cannot meet the public contract.

Do not maintain a private SDK fork merely to preserve the selected stack.

### Package-Split Gate

Split a package only after a second consumer, optional dependency closure, or
independent release need appears.

### Production-Exposure Gate

Before non-loopback use, prove intermediary, authority, Origin, proxy trust,
limits, redaction, readiness, and shutdown behaviour.

### Protected-Service Gate

Prove one OAuth mode end to end before adding alternate modes.

### Loopback Progress Gate

A loopback-only POST progress claim requires cancellation, timeout, event-count
and notification-payload bounds, terminal ordering, and JSON/SSE final-result
parity. It implies no intermediary, queue, backpressure, replay, or subscription
behaviour.

### Production and Intermediary Streaming Gate

No production or intermediary streaming claim exists until proxy, queue,
backpressure, overflow, slow-consumer, resynchronisation, and final-response
tests pass.

### Interaction-and-Effects Gate

Elicitation precedes approval.

Approval remains server-owned, authenticated, single-use, replay-safe, and
accessible. Client navigation consent never authorizes an effect.

### Distributed Gate

Prove single-instance semantics and races first.

Add shared state only for the capability being distributed.

### UI-Framework Gate

Implement the ratified optional React and Tailwind packages only through the
shared public UI contract. Native and React renderers must pass the same
fixtures, security rules, and accessibility checks. Client navigation or state
never authorizes an effect.

### Full-Claim Gate

Seek the full claim only after complete active-surface coverage. Otherwise ship honest composable module claims.

## Contact Drills

### Public Baseline Contradicts the Guide

Immediate action:

- stop the affected implementation;
- preserve unrelated work;
- derive a raw request corpus from authoritative public sources; and
- amend the acceptance record using authoritative public sources.

Resume when the schema, normative text, and request corpus agree.

### SDK Emits Incompatible Wire or Session Behaviour

Immediate action:

- contain it behind the codec boundary;
- disable incompatible defaults; and
- replace it if adaptation becomes a maintained private fork.

Resume when the first raw-wire and independent-client checks pass.

### First Tool Cannot Pass

Immediate action:

- add no features;
- simplify the stack or replace the SDK or runtime; and
- reduce the slice without weakening safety.

Resume when discovery, listing, calling, malformed-input, cancellation, and zero-call tests pass.

### Guide Ambiguity or Contradiction

Immediate action:

- convert it into an observable acceptance scenario;
- resolve it through an observable acceptance scenario and authoritative public
  sources; and
- continue unrelated work.

Resume the affected work when an approved amendment or public-source resolution exists.

### Example Needs a Private Escape Hatch

Immediate action:

- freeze feature breadth;
- fix the shared public boundary once; and
- remove the example-specific exception.

Resume when two unrelated examples use identical public framework APIs.

### Streaming Buffers or Leaks Work

Immediate action:

- withdraw the streaming claim;
- retain proven JSON support; and
- repair the state machine or intermediary path.

Resume when slow-reader, disconnect, bounded-queue, and final-response tests pass through the real intermediary.

### Queue Overflow Defeats Notification Guarantees

Immediate action:

- close predictably;
- require resynchronisation; and
- never silently drop while claiming guaranteed delivery.

Resume when the deterministic slow-consumer test passes.

### OAuth Dependency Cannot Prove Required Controls

Immediate action:

- stop protected and effectful work;
- replace the dependency or narrow the profile; and
- keep public or read-only proven work available.

Resume when issuer, audience, scope, token separation, SSRF, and security-negative checks pass.

### Shared Provider Cannot Prove Atomic Behaviour

Immediate action:

- retain explicit single-instance support; and
- remove the distributed capability claim.

Resume when cross-instance race and unavailable-provider tests pass.

### UI Expands Beyond Bounded Form and Approval Flows

Immediate action:

- retain the shared native contract and server-owned approval state;
- keep React and Tailwind outside server core;
- add no component library, theme system, or client authorization path; and
- open a new decision only for a materially broader UI product or renderer.

Resume expanded UI work when accessibility, security, routing, and state
requirements justify the additional surface.

### Dependency Licence, Vulnerability, or Abandonment Blocks Release

Immediate action:

- replace the dependency at its narrow boundary;
- avoid a private fork unless replacement is impossible; and
- preserve public behaviour through black-box tests.

Resume when compatible licensing, integrity, and security checks pass.

### Performance Misses a Placeholder

Immediate action:

- profile first;
- replace placeholder numbers with measured adopter budgets; and
- do not remove safety limits or validation blindly.

Resume when a reproducible benchmark identifies and clears the framework-owned regression.

### Conformance Work Becomes a Custom Governance Product

Immediate action:

- delete the bespoke control plane;
- return to standard CI evidence, checksums, software bills of materials, traceability, reproducibility, and independent review; and
- reassess whether the exact claim remains supportable.

Resume when ordinary evidence is sufficient for the stated claim.

## Pivot Criteria

Pivot deliberately when evidence shows the current route no longer serves the objective.

- Pivot from the full claim to composable module claims if independent clients cannot cover the complete active surface.
- Pivot from the universal framework to a narrower tools and HTTP product if a second unrelated service cannot reuse the public API without kernel exceptions.
- Pivot from distributed to explicit single-instance support whenever atomic shared-state guarantees remain unproven.
- Pivot from streaming to JSON-only whenever intermediary or backpressure semantics are unsafe.
- Pivot from the selected SDK or runtime when the first operating capability requires a maintained private fork.
- Withdraw an optional renderer claim and retain the shared native contract if
  that renderer adds more accessibility or security risk than user value.

## Escalation Criteria

Require an explicit architecture or product decision before changing:

- the pinned protocol baseline or conformance claim;
- the language or runtime after the first spike;
- a released public API;
- a package boundary;
- a shared-state provider;
- a second transport;
- the shared public UI contract or optional renderer package boundaries;
- security invariants or approved licences; or
- the declared release scope.

## Abort Criteria

Abort the full implementation objective only if:

- public normative sources cannot be independently verified;
- mandatory public requirements remain mutually impossible after clarification; or
- universal reuse is disproven and a narrower product is explicitly rejected.

An abort decision does not erase proven reusable modules or evidence. Preserve any safe, independently useful result.

## Dependency Doctrine

For every dependency:

1. Prefer an existing maintained open-source solution over bespoke implementation.
2. Record its public source, version, licence, integrity, protocol support, and reason for use.
3. Pin it through the native lockfile and verify reproducible resolution.
4. Keep it behind the narrowest practical boundary.
5. Test public behaviour rather than trusting the dependency brand.
6. Replace it if it forces unsafe semantics, a private fork, incompatible licensing, or unacceptable maintenance risk.
7. Write custom code only for framework-specific orchestration or a demonstrated gap that no suitable dependency covers.

Likely dependency areas include the public MCP SDK and schemas, JSON Schema
validation, HTTP and Server-Sent Events, OAuth and JSON Web Tokens (JWT),
Uniform Resource Identifier (URI) templates, canonical JSON, OpenTelemetry,
testing, accessibility, security scanning, and release provenance.

## Monorepo Doctrine

- Begin with one publishable framework package.
- Keep protocol, HTTP, runtime, tools, security, and operations as internal modules.
- Examples depend only on the public package.
- Black-box tests primarily use the real HTTP boundary.
- The framework never imports examples or conformance runners.
- Do not create a shared package until demonstrated duplication cannot be removed more simply.
- Extract conformance, OAuth, telemetry, or extension packages only when independent use or optional dependency closure requires it.
- Use the language's native workspace support and one root lockfile.
- Add a monorepo task runner only when native workspace commands measurably fail the need.

## Example Doctrine

An example directory lands only when the same change contains:

- working implementation through public APIs;
- one documented deployment boundary;
- one start command;
- one end-to-end smoke command through the public endpoint;
- one positive independent-client invocation;
- one relevant negative boundary check;
- synthetic data only;
- one mandatory semantic Promptfoo case that:
  - runs three fresh agent trials and three independent judge trials;
  - gives model processes no Model Context Protocol tools;
  - checks deterministic facts and exact protocol-path evidence; and
  - performs the live operation through the official client;
- a clean-checkout CI run.

Do not scaffold empty future examples.

## Battle Rhythm

At every evidence checkpoint:

1. Restate the current operating objective.
2. Inspect the newest protocol, client, dependency, security, performance,
   accessibility, and operational evidence.
3. Identify the highest-risk unknown or highest-value blocked adopter outcome.
4. Select the smallest safe manoeuvre that changes that evidence.
5. Record any decision that constrains future work.
6. Update this battle plan when the route changes.
7. Report only the exact capability and deployment boundary proven.

Do not preserve a failed sequence for historical neatness. Preserve the evidence and objective.

## Architecture Decisions

Before the first runtime edit, record:

1. The revised framework scope and conformance claim, including the 110-item coverage ledger and removal of bespoke certification.
2. The runtime, package manager, open-source dependency and licensing policy, and monorepo boundary.
3. The public API, deterministic contract output, dependency direction, and module-derived capability claims.
4. Ordinary reproducible conformance and release evidence.

Record later, immediately before their owning fronts:

5. Streaming states, overflow, termination, and resynchronisation.
6. Authentication, effects, idempotency, and local or distributed state ownership.
7. The shared accessible UI contract, server-owned approval authority, and
   optional React and Tailwind package boundaries.
8. Compatibility, extensions, a second transport, and package-splitting triggers.

## Immediate Orders

1. Remediate every non-generated published file that fails the mandatory
   cognitive-accessibility review.
2. Fix the generated decisions compendium through its owning generator. Do not
   hand-edit the generated file.
3. Implement and qualify the ratified optional React and Tailwind packages with
   native and React examples using the same fixtures and states.
4. Add multi-instance operation only after local state and race semantics pass.
5. Record a website decision covering generator, host, dependencies, and
   publication before implementing or deploying the documentation website.
6. Make no runtime capability claim without current clean-checkout evidence.
7. Keep authoritative semantic qualification and npm publication pending while
   R001 remains outside appetite.

## Known Contradictions

Resolve each guide contradiction only when its owning capability front begins:

- handler-backed first tool versus workflow arriving later
- final validation before emission versus progress during execution
- guaranteed notifications versus bounded queues and no replay
- JSON-only services versus `json-and-sse` manifest semantics
- the illustrative manifest missing mandatory fields
- the public status of mirrored headers, projection, discovery, result types,
  and error codes

## Campaign Log

### 2026-08-26: No-UI Beachhead Claim Withdrawn

The uncommitted scaffold contains a no-UI implementation and black-box tests,
but the current checkout does not compile. It therefore proves no runtime
capability yet.

Evidence:

```sh
npm test
```

At that checkpoint, the command failed because five production-boundary symbols
were undefined. The claim remained withdrawn until the later clean-checkout
quality gate passed the real HTTP and independent-client checks.

### 2026-08-27: No-UI and Invocation-Scoped OAuth Slice Restored

The clean-checkout quality gate now passes the real Fastify HTTP boundary and
the independent MCP client. The exact current claim is the pre-alpha slice in
the repository README; unsupported capabilities remain excluded. Publication
under `next` remains pending the current accessibility, semantic, and release
gates.

### 2026-08-27: Checked Mapped-Adapter Slice Qualified

The public `defineMappedTool` path now validates public input, backend commands,
backend results, and final public output inside the same deadline, cancellation,
authorization, and safe-error lifecycle as direct tools. Memory and file
adapters pass the real HTTP-boundary checks without kernel changes. The exact
committed revision passed the clean-checkout test, mapped benchmark, and audit
gates on Node.js 22 and 24 in the
[GitHub Actions qualification run](https://github.com/windyroad/emseepea/actions/runs/33031986348).
Outbound HTTP policy, credentials, retries, effects, and workflow execution
remain excluded.

### 2026-08-27: Public Resource and Prompt Slice Qualified

Public static-resource listing and reads and public prompt listing and rendering
now pass raw HTTP and independent-client checks. Their handlers remain
identity-free when OAuth is configured and share the checked deadline,
cancellation, result-validation, size-limit, and generic-error boundary. The
exact committed revision passed the clean-checkout test, benchmark, and audit
gates on Node.js 22 and 24 in the
[GitHub Actions qualification run](https://github.com/windyroad/emseepea/actions/runs/33035207338).
The public non-enumerating resource-template revision passed its public-boundary
tests and dependency audit on Node.js 22 and 24 in the
[GitHub Actions qualification run](https://github.com/windyroad/emseepea/actions/runs/33037095029).
The existing JSON/tools benchmark also remained green; it does not cover template
performance. Template enumeration, completion, pagination, and cache
configuration remain excluded.

### 2026-08-27: Opt-In Completion Quality Qualified

Prompt arguments and resource-template variables can opt into completion through
their existing public definitions. Local raw-HTTP and official-client checks
cover exact capability admission, disabled-method rejection, startup key
validation, immutable handler capture, required and optional prompt arguments,
sanitized sibling context, candidate validation and truncation, deadlines,
disconnect cancellation, concurrent-request isolation, bounded results, generic
errors, verifier-free public access, and both prompt and template references.
The compiled example and a freshly packed and installed package pass their real
HTTP completion smokes. Independent code and post-implementation architecture
reviews pass. The exact revision passed Node.js 22 and 24 in the
[clean-checkout qualification run](https://github.com/windyroad/emseepea/actions/runs/33047382337).
No completion performance claim is made.

### 2026-08-27: Loopback Streaming Progress Quality Qualified

Checked POST-scoped progress, JSON fallback, cancellation, terminal ordering,
authorization before streaming, and bounded event size and count passed the
[Node.js 22 and 24 qualification run](https://github.com/windyroad/emseepea/actions/runs/33070295308).

This evidence covers loopback-only operation. It does not support production or
intermediary streaming, subscriptions, replay, sessions, backpressure, or
resynchronisation claims.

### 2026-08-27: Protected Example Quality Qualified

The protected inventory example keeps discovery and tool listing public. Its
tool call requires the synthetic `inventory:read` scope and distinguishes
on-hand, reserved, available-to-promise, and inbound inventory.

The exact revision passed the
[Node.js 22 and 24 quality run](https://github.com/windyroad/emseepea/actions/runs/33084800356).
The example is not production OAuth authorization guidance.

### 2026-08-27: Five-Example Semantic Harness Added

ADR-0022 requires Promptfoo qualification for every example. The shared gate
runs three fresh agent trials and three independent judges without MCP tools for
each example. It requires deterministic critical facts and exact MCP path
evidence, allows no semantic retries, and emits redacted evidence.

Provider policy blocked autonomous custom MCP use in authoritative CI. The
ratified harness therefore performs the live official-client operation and
binds the result before a tool-free model interprets it.

The harness now covers basic, backend, protected, resources-and-prompts, and
streaming-progress examples. Earlier local advisory evidence covered the first
four examples. Authoritative qualification of all five through the GitHub
Copilot command-line interface (CLI) and `claude-sonnet-4.6` remains pending for
the exact publishing commit.

## Implementation Goal

Implement and independently qualify a monorepo-based universal Model Context
Protocol `2026-07-28` Streamable HTTP server framework with opt-in capabilities.

Provide a comprehensive verified-current documentation website and working
no-UI, native UI, React UI, streaming, and multi-instance examples. Use approved
open-source dependencies and honest composable claims during delivery. Revise
the full active server-surface claim only when complete coverage is proven from
clean checkouts. Do not build bespoke cryptographic certification.
