---
status: "proposed"
date: 2026-09-21
human-oversight: pending
supersedes: ["ADR-0102"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Pipeline risk review"]
informed: []
reassessment-date: 2026-12-21
---

# Proved Proxy Boundary for Production Deployments

A deployment whose proxy has no stable address proves the request came through
the proxy. The proxy injects a secret and the server checks it, rather than the
deployment declaring that the platform enforces the boundary. The declared
count of appended `x-forwarded-for` entries carries over from ADR-0102
unchanged.

Reassessment is due 2026-12-21.

## Context and Problem Statement

ADR-0102 gave a deployment two ways to state a fact about the proxies in front
of it. One of them shipped and is unaffected: `forwardedHops`, the count of
entries the infrastructure appends after the client address.

The other was `proxyBoundary: "platform-enforced"`, a declaration that the
platform already stops anything but its own load balancer reaching the server.
Pipeline risk review scored it 8 out of 25 against an appetite of 5 and refused
the commit. The reasoning was that the remaining checks — forwarded protocol,
authority, origin, rate limit — are all settable by whoever sends the request,
so the address comparison was the only one distinguishing "came through the
load balancer" from "came from anywhere". A declaration that replaced it could
not be checked, and a false declaration removed the check and put nothing in
its place.

The failure direction is what makes this worse than it first appears. An
adopter who declares the boundary wrongly gets a server that accepts
everything, quietly, and nothing reports it. The problem ADR-0102 set out to
fix announced itself: the container did not start.

## Decision Drivers

- A security control the framework cannot check is a control the framework does
  not have.
- A misconfiguration should refuse requests, not admit them.
- The reported deployment has no stable peer address and must still be able to
  run, which is what ADR-0102 set out to fix and this record keeps.
- The secret is a credential, and the deployment config file is documented as
  carrying non-secret policy only.

## Considered Options

1. **Prove the hop with a secret the proxy injects.** The proxy adds a header;
   the server compares it and refuses anything else.
2. **Declare the boundary and take it on trust**, as ADR-0102 decided.
3. **Verify a platform-signed assertion**, such as a Google IAP or AWS ALB
   OIDC token, checked against the platform's published keys.
4. **Restrict the declaration to deployments with no public capabilities**, so
   a false claim exposes only authenticated surface.
5. **Do nothing**, and leave these platforms unable to deploy.

## Decision Outcome

Chosen option: **prove the hop with a secret the proxy injects**, because it
turns an unverifiable claim into a check, and because it inverts the failure
direction: a proxy that is not sending the header refuses every request rather
than admitting every request.

`proxyBoundary` takes a header name and a secret. A deployment supplies either
`trustedProxyAddresses` or `proxyBoundary`, never both and never neither.
Proving the hop replaces the address comparison and changes nothing else.

Option 3 is stronger and stays open. It needs key fetching, caching and
rotation, and it is platform-specific — a plain load balancer in front of a
container offers no signed assertion, so it would not have fixed the reported
deployment. Option 1 works on any proxy that can add a header, which is what
that deployment needs today.

Option 4 was rejected because it bounds the damage of a false claim without
making the claim checkable.

## Consequences

- Good: a misconfigured boundary fails closed. The adopter learns immediately,
  from refused requests, rather than never.
- Good: the value is a secret a caller has no way to guess, so unlike an address
  allowlist it does not rest on the network being trustworthy.
- Bad: the deployment now has a credential to hold and rotate, on a path that
  previously had none. The config file names the environment variable rather
  than carrying the value, which keeps the file non-secret but adds a step.
- Bad: a leaked secret admits a caller until it is rotated. An address
  allowlist has no equivalent, though it also cannot be used on these
  platforms at all.
- Bad: the secret travels as a request header, so the adopter's own proxy or
  CDN may log it. The framework can say it does not log the value itself; it
  cannot stop the infrastructure in front from doing so, and header logging is
  a common default. Every adopter-facing surface has to say this, because it
  is the cost of moving from a network-position check to a bearer secret.
- Neutral: adopters using `trustedProxyAddresses` are unaffected.

## Confirmation

- A profile with neither `trustedProxyAddresses` nor `proxyBoundary` is refused
  at construction, and so is one carrying both, on the API path and through the
  configuration file.
- A request carrying the right secret is served from any peer address. The
  server still refuses a disallowed authority, a disallowed origin, a
  non-HTTPS forwarded protocol and a rate-limited client.
- A request with the header absent, empty, wrong, or a prefix or extension of
  the secret is refused, and so is one sending the header twice.
- The refusal names neither the header nor any part of the value, and carries
  the same message as an address failure.
- The secret reaches no observability adapter, on the served path or the
  refused one.
- A secret shorter than 32 characters is refused at construction, as is a
  header name that is not a valid token, and any `x-forwarded-*` header,
  `forwarded`, or `host`.
- The comparison is constant-time over equal-length digests.
- The configuration file names the environment variable holding the secret and
  is refused when that variable is unset. A loaded profile carries the resolved
  value.
- `trustedProxyAddresses` still rejects a CIDR at construction.
- Everything ADR-0102 confirmed about `forwardedHops` still holds.

## Reassessment Criteria

- If a platform-signed assertion becomes available across the platforms this
  project supports, option 3 becomes the better answer and this record should
  be revisited.
- If a deployment needs more than one valid secret at once, for rotation
  without downtime, the single-secret shape is too narrow.

## Related

- Supersedes ADR-0102, whose `forwardedHops` half is carried over unchanged and
  whose declared-boundary half is replaced.
- GitHub issue 119 reported the deployment that could not start.
- GitHub issue 120 reported the multi-entry header, fixed by the hop count.
