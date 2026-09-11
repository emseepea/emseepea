---
status: "proposed"
date: 2026-09-11
human-oversight: confirmed
oversight-date: 2026-09-11
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-11
---

# Opt-In Checked Client Roots

## Context and Problem Statement

MCP 2026-07-28 still includes the deprecated `roots/list` client-input
request. It lets a server ask a capable client which file or directory roots
the client has made available. Em See Pea already supports the protocol's
`input_required` round trip for elicitation, but explicitly rejects roots.

This increment decides whether direct application handlers may request and
consume roots through that existing round trip. It does not make roots an
authorization mechanism and does not add file access, network access, catalogue
changes, sessions, retries, replay, persistence, or reconnect recovery.

## Decision Drivers

- Complete one small remaining MCP 2026-07-28 server behaviour.
- Reuse the checked `input_required` flow instead of adding another round-trip
  mechanism.
- Treat every root as untrusted client input.
- Bound client-controlled collections before application continuation work.
- Preserve authentication, authorization, cancellation, deadlines, and signed
  request-state behaviour on every round.
- Keep existing applications and legacy protocol requests unchanged.

## Considered Options

1. **Checked bounded roots through existing input-required rounds**: applications
   opt in, direct handlers can request roots, and the framework validates the
   response before the continuation handler runs.
2. **Expose raw SDK roots responses**: allow the SDK request and pass the client
   response directly to application handlers.
3. **Keep roots unsupported**: retain the current explicit rejection.

## Decision Outcome

Chosen option: **"Checked bounded roots through existing input-required
rounds"**, because it completes the protocol behaviour through the existing
round-trip boundary without letting unchecked client-controlled paths reach
application code.

Applications opt in with `clientRoots: { maxRoots?: number }`. The framework
copies and validates this setting at startup. `maxRoots` defaults to 100 and
must be a positive safe integer. The existing `maxRequestBytes` limit still
bounds the whole continuation request, including every root URI, name, and
metadata value. This keeps one byte limit instead of adding another.

The existing `inputRequired` helper gains `inputRequired.roots()`. Direct tools,
static resources, resource templates, and prompts may return that request through
their existing `input_required` result. A roots-response accessor returns a
checked immutable view of the roots for a named input-response key. Mapped tools,
streaming tools, completions, lists, and subscriptions remain unchanged.

Before sending a roots request, the framework checks that the current modern
request declares the standard client roots capability. Before the continuation
handler runs, it checks the SDK roots schema, configured root count, request
deadline, and cancellation. The handler checks its expected response key using
the checked roots accessor. The framework cannot identify unexpected keys from
an earlier round without saved application state. Missing capability declarations,
malformed roots responses, too many roots, and legacy roots requests fail with
bounded public errors before the continuation handler runs.

Every protected round performs its ordinary authentication and authorization.
Roots are client-supplied descriptors only. They do not grant authority, select
a capability, weaken principal binding, or become backend credentials. Em See
Pea does not dereference them, read files, make network requests, log them
automatically, or copy them into observability events.

Existing signed request state remains the opt-in way to carry continuation
state across processes and bind it to the method, capability, principal,
expiry, and application payload. Without signed request state, the framework
validates the current round but does not prove that the response belongs to a
specific earlier server result.

The server advertises no new capability. Roots are a client capability declared
on each request. This increment adds no roots list-change notification, transport
session, retry, replay, persistence, reconnect recovery, or dependency.

## Consequences

### Good

- Direct handlers can use the remaining standard roots input request.
- Existing request-size, timeout, cancellation, authentication, authorization,
  and signed-state boundaries govern the new path.
- Application code receives checked roots rather than raw client input.

### Neutral

- Roots remain deprecated but present in the active protocol version.
- Applications choose whether to enable them and may raise the count limit for
  a larger legitimate client workspace.
- A continuation without signed request state is validated, but it is not tied
  to a specific earlier server result.

### Bad

- The public client-input API gains one option, one request helper, and one
  response accessor for a deprecated feature.
- Applications still decide what any returned root means and whether their own
  code is permitted to use it.

## Confirmation

- Omitting `clientRoots` preserves current public types and runtime behaviour
  except for the new opt-in declarations.
- Invalid `clientRoots` values fail server creation. The default accepts at most
  100 roots, while a configured positive safe integer changes that count limit.
- Direct public and protected tools, static resources, resource templates, and
  prompts complete a roots round through the official MCP client.
- Raw HTTP tests cover a valid request and continuation, missing or malformed
  client capability metadata, missing and wrong-kind accessor results, malformed
  roots, non-file URIs, excess roots, oversized request bodies, cancellation,
  deadlines, and safe errors with zero continuation work after rejection.
- Protected tests prove that every round authenticates and authorizes normally
  and that roots never grant access.
- Signed request-state tests prove restart and cross-process continuation without
  claiming single use or replay prevention.
- Mapped tools, streaming tools, completions, lists, subscriptions, legacy
  requests, observability, and disabled applications retain their existing
  behaviour.
- Type tests cover the roots helper and accessor and reject raw or wrong-kind
  client responses.
- Packed-package and published documentation checks exercise the released API.

## Pros and Cons of the Options

### Checked Bounded Roots Through Existing Input-Required Rounds

- Good: Completes the behaviour with checked input and minimal new machinery.
- Bad: Adds framework API for a deprecated protocol feature.

### Expose Raw SDK Roots Responses

- Good: Requires less validation code.
- Bad: Lets unbounded, unchecked client-controlled paths reach handlers.

### Keep Roots Unsupported

- Good: Adds no code or public API.
- Bad: Leaves a defined MCP 2026-07-28 client-input behaviour unsupported.

## Performance Review

Source: **no data - planning assumptions only**.

The default permits at most 100 roots inside the existing one-mebibyte request
limit. Validation is linear in the root count and encoded request size. At 100
continuations per second, the worst admitted input is 100 MiB per second before
JSON parsing overhead. This is a qualification input, not a throughput claim.
Existing JSON-boundary evidence does not cover this continuation path.

## Reassessment Criteria

Reassess if MCP removes roots, replaces them with a new workspace-context
mechanism, or measured use shows that the default count or existing request-size
limit is unsuitable.
