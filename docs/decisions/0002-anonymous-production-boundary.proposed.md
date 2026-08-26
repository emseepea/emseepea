---
status: "proposed"
date: 2026-08-26
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-26
---

# Explicit Anonymous Production Boundary Behind a Trusted Proxy

## Context and Problem Statement

The default loopback profile must fail closed outside localhost. A useful next
deployment boundary is an anonymous MCP server behind an HTTPS reverse proxy.
Forwarding headers from arbitrary peers are untrusted, and an unbounded
anonymous endpoint is not a supportable production claim. The boundary must be
explicit without implying authentication, effects, streaming, or distributed
state.

## Decision Drivers

- Fail-closed separation between development and production exposure.
- No trust in caller-supplied forwarding metadata.
- Exact, reviewable configuration instead of wildcard trust.
- Bounded anonymous resource use before handler execution.
- Honest single-instance scope.
- Minimal operational machinery for the first production profile.

## Considered Options

1. **Explicit trusted-proxy production profile** - Add a separately named
   profile with exact proxy, authority, origin, HTTPS, and bounded rate-limit
   controls.
2. **Loopback-only operation** - Make no production deployment available yet.
3. **Full authenticated distributed boundary** - Require OAuth, shared state,
   and multi-instance enforcement before any production profile.

## Decision Outcome

Chosen option: **"Explicit trusted-proxy production profile"**, because it is the smallest production boundary whose trust and resource assumptions can be stated and tested honestly.

Loopback remains the default. Non-loopback binding requires the explicit
`production-behind-proxy` profile with exact trusted proxy IP literals, exact
public authorities, exact HTTPS origins, and a bounded fixed-window rate
limiter. Wildcards, CIDR ranges, and implicit proxy trust are not supported.

The immediate peer identity comes only from the network socket. IPv4-mapped
IPv6 peer addresses are normalized to IPv4 before exact comparison. Forwarding
headers are considered only after the socket peer matches a configured proxy.
`X-Forwarded-Proto` must contain exactly `https`. `X-Forwarded-For` must contain
exactly one valid IP literal; comma-separated chains are rejected. That client
IP is used only as the anonymous rate-limit key.

Public authorities are parsed and normalized as URL authorities: DNS names are
lowercased, an explicit default HTTPS port is equivalent to its omission, and
all other ports remain significant. The HTTP `Host` authority must match a
configured authority. When `Origin` is present, it must be an exact normalized
configured HTTPS origin.

All deployment validation and rate limiting occur before MCP handler execution.
The single-instance limiter has bounded client state and fails closed when its
table is full. Health and readiness expose no application data and remain
available to local orchestration without public forwarding headers.

There is no formal performance budget for this boundary yet. This ungoverned
risk is accepted temporarily; measurements are required before making any
production-performance claim. A shared limiter is required before claiming
multi-instance enforcement.

## Consequences

### Good

- Production exposure cannot be enabled through one permissive flag.
- Spoofed forwarding headers from untrusted peers fail before application code.
- Anonymous request state and request frequency are bounded.
- The claim clearly stops at one instance behind a trusted TLS terminator.

### Neutral

- TLS termination remains a deployment responsibility.
- Local health and readiness use a deliberately narrower trust surface.

### Bad

- Exact IP configuration does not support dynamic proxy ranges or proxy chains.
- Fixed-window enforcement can permit bursts around a window boundary.
- Proxy compromise is outside the framework trust boundary.
- Performance remains ungoverned until measured.

## Confirmation

Black-box tests prove, before any MCP handler call:

- public binding is impossible in the loopback profile;
- untrusted peers and IPv4-mapped comparison errors are rejected;
- missing, repeated, chained, or non-HTTPS forwarding metadata is rejected;
- invalid client IPs, authorities, ports, and origins are rejected;
- rate limits, bounded state, saturation, and window expiry behave as configured;
- accepted and rejected requests are measured before any performance claim;
- health and readiness remain free of application data and locally usable;
- the original loopback behavior remains qualified; and
- no authentication, protected, streaming, distributed, or performance
  capability is advertised by this profile.

## Pros and Cons of the Options

### Explicit trusted-proxy production profile

- Good: Adds a narrow deployable boundary with exact tests.
- Bad: Requires correct proxy isolation and configuration.

### Loopback-only operation

- Good: Has the smallest attack surface.
- Bad: Prevents meaningful remote deployment and validation.

### Full authenticated distributed boundary

- Good: Could support protected multi-instance applications.
- Bad: Conflates several independent capability fronts and adds shared
  infrastructure before it is required.

## Reassessment Criteria

Reassess when a second instance is deployed, proxy chains or CIDR trust become
necessary, authentication is enabled, measured performance warrants a formal
budget, or direct TLS termination becomes a supported framework responsibility.
