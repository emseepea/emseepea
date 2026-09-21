---
status: "proposed"
date: 2026-09-21
human-oversight: confirmed
oversight-date: 2026-09-21
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-21
---

# Declared Proxy Topology for Production Deployments

Two additions to the `production-behind-proxy` deployment profile. Each lets a
deployment state a fact about the proxies in front of it that the framework
cannot work out for itself. The first is a declared platform-enforced proxy
boundary, in place of a peer address allowlist. The second reads the client
address from a declared position in a multi-entry `x-forwarded-for`, instead of
refusing every such header. Tom Howard ratified this on 2026-09-21.

Reassessment is due 2026-12-21.

## Context and Problem Statement

Two reported problems stop a Cloud Run deployment behind a Google external
Application Load Balancer, one after the other. Both were reported against
0.16.0 and both are current.

The first is that the server cannot start. `production-behind-proxy` requires
`trustedProxyAddresses`, `normalizeIp` rejects anything that is not a literal
address, and `validateProductionRequest` requires exact set membership of the
socket peer. The reporter found no stable peer address to name — the value they
observed is platform infrastructure rather than anything documented as fixed, so
anything written there would be a guess about undocumented behaviour inside a
security control. The reporter used `0.0.0.0/0` to mean "the
boundary is enforced below us" and `createEmseepea` threw at construction, so
the container never listened and the deploy failed (issue 119).

The second is that, once the peer check passes, every request is refused.
`validateProductionRequest` treats any comma in `x-forwarded-for` as
disqualifying:

```js
const client = forwardedFor && !forwardedFor.includes(",") ? normalizeIp(forwardedFor) : undefined;
if (proto !== "https" || !client) return reject(403, "Invalid forwarding metadata");
```

A Google load balancer appends rather than replaces, so the header arrives with
at least two entries, `client` is always `undefined`, and the endpoint answers
403 to everything (issue 120).

That reading was inferred when this record was first written. It has since been
measured. The reporting session deployed instrumentation to the affected service
and read three requests: two `x-forwarded-for` entries every time, the forwarded
protocol present exactly once and exactly `https`, no duplicated field, and a
peer matching the configured trusted proxy. `Invalid forwarding metadata` is one
message covering seven conditions — a missing, duplicated or non-`https`
forwarded protocol, and a missing, duplicated, multi-entry or non-address
forwarded-for — and the measurement eliminates every one of them except the
multi-entry branch. That is the cause.

Measured is not the same as verified in production, which needs a release and a
request that succeeds. And the decision below would stand either way: the
multi-entry refusal is real in the code and pinned by a black-box test, so
`forwardedHops` is justified by the code path a multi-entry header takes rather
than by this deployment's particular 403.

The two look like separate compatibility gaps. They are the same gap. In both
cases the deployment knows something true about its proxy layer — that the
platform enforces the boundary, and how many entries the proxies append — that
the framework has no way to observe and currently no way to be told.

`client` is also the rate-limit key, which is what makes the second one a
correctness question rather than a convenience one. The obvious widening, take
the first entry, is wrong: the first entry is whatever the caller sent, so a
caller could rotate it and never be limited. That is worse than refusing.

## Decision Drivers

- The framework keeps making the security decision. A fix that moves the
  decision into the adopter's proxy configuration has not fixed it.
- An adopter must not have to guess at undocumented platform behaviour inside a
  security control.
- A value a caller controls must never become the rate-limit key.
- Existing deployments must not change behaviour.
- Getting the declaration wrong should fail closed and say what is wrong.

## Considered Options

1. **Let the deployment declare its proxy topology**: a platform-enforced
   boundary in place of an address allowlist, and a count of appended entries.
2. **Accept a CIDR range in `trustedProxyAddresses`** (Classless Inter-Domain
   Routing, an address block such as `10.0.0.0/8`), and take the first
   `x-forwarded-for` entry.
3. **Accept a CIDR, and take the last entry.**
4. **Do nothing**, and document that these platforms are unsupported.

### Pros and Cons of the Options

**Option 1 — declare the topology**

- Good: says the true thing for Cloud Run, App Runner and Container Apps, where
  the ingress guarantee is the control and an address list restates it in a form
  the adopter cannot write correctly.
- Good: indexing from the end means a caller-supplied prefix cannot reach the
  rate-limit key, as long as the declared count is right. Indexing from the
  start fails even when it is.
- Good: leaves the CIDR rejection invariant intact, which two black-box tests
  pin deliberately.
- Bad: two new fields, and a deployment that declares the wrong hop count is
  refused rather than served.
- Bad: a declared platform-enforced boundary is trust in a configuration
  statement. A deployment that declares it without the platform guarantee has
  disabled the peer check and will not be told.

**Option 2 — CIDR and the first entry**

- Good: smaller, and `0.0.0.0/0` would have worked as the reporter expected.
- Bad: the first entry is caller-controlled, so it silently turns the
  rate-limit key into a value an attacker chooses. This is the option the
  reporter explicitly argued against, and it is the reason to reject it.
- Bad: reverses an invariant chosen on purpose and pinned by tests.
- Bad: `0.0.0.0/0` as a trusted range is an address check that permits every
  address. It reads as a control and is not one.

**Option 3 — CIDR and the last entry**

- Good: the last entry is not caller-controlled.
- Bad: the last entry is the address the innermost proxy observed, which is the
  proxy in front of it, not the client. Every client behind one load balancer
  would share a rate-limit key.
- Bad: same reversed invariant as option 2.

**Option 4 — do nothing**

- Good: no new surface, no new way to misconfigure.
- Bad: the platforms most likely to host this framework cannot run it in the
  only mode that carries the authority, origin and rate-limit checks. The
  alternative an adopter is left with is `loopback`, which drops all three.

## Decision Outcome

Chosen option: **let the deployment declare its proxy topology**, because it is
the only option that keeps the framework making the decision while letting the
adopter supply the one fact it cannot observe.

Two additions to the `production-behind-proxy` profile.

**A platform-enforced proxy boundary.** The profile accepts either
`trustedProxyAddresses` as today, or `proxyBoundary: "platform-enforced"`, and
exactly one of the two. Declaring the boundary platform-enforced skips the peer
comparison and changes nothing else: the protocol, authority, origin and
rate-limit checks all still run. `trustedProxyAddresses` keeps rejecting
anything that is not a literal address, so the CIDR invariant stands.

This is a statement of fact by the deployment, and the framework takes it at its
word because it has no way to check it. That is the cost, and it is recorded
below rather than argued away. Because it cannot be checked it is at least made
visible: a server started with the peer check disabled by declaration says so
once at startup, so the choice appears in the record of a running deployment
rather than only in a configuration file.

**A declared count of appended entries.** The profile accepts
`forwardedHops`, a non-negative integer that says how many entries the
proxies in front append *after* the client's address. The name and the
semantics follow the implementation the reporting session wrote for issue 120,
which reached the same shape independently. It defaults to 0, which keeps today's comma rule: the header
must carry a single entry, and any comma is a refusal — which `production-boundary.test.mjs` pins, alongside the two
tests that pin the CIDR rejection. The default is applied when the profile is
normalized, not when it is loaded, because `deployment-environment.test.mjs`
asserts that a loaded profile equals the file it came from.

With `forwardedHops` set to N, the header must carry at least N+1 entries
and the client address is the entry N positions from the end.

Each entry is trimmed before it is parsed. `normalizeIp` does not trim, and
senders usually separate entries with a comma and a space, so splitting on the
comma leaves a leading space on every entry after the first.

A header with fewer entries than declared is refused. The refusal names the
hop-count mismatch **in the server's log record, not in the response**. The
operator calibrating the count is the one who needs that diagnostic. Telling the
caller would let a refused caller learn their prefix was too short and add
entries until they were served — which is the over-count attack below, with the
server counting it out for them. The response
stays the single generic message.

A caller cannot escape this by sending a second `x-forwarded-for` field either:
`singleHeader` already returns no usable value when a field name appears twice.
`production-boundary.test.mjs` pins that today for a repeated
`x-forwarded-proto`; under hop indexing a repeated `x-forwarded-for` is the
move a caller would make to shift the index, so it gains its own check
below.

Counting from the end is the whole point. A caller who sends their own
`x-forwarded-for` adds entries at the front, so their value shifts the client
address further from the start and leaves its distance from the end unchanged.
Under the Google topology the reporter describes, `<client>, <balancer>` and
`<caller-supplied>, <client>, <balancer>` both yield `<client>` at
`forwardedHops: 1`.

## Consequences

### Good

- A Cloud Run deployment can run in `production-behind-proxy` and keep the
  authority, origin and rate-limit checks instead of dropping to `loopback`.
- A caller cannot reach the rate-limit key by prepending to the header, as
  long as the declared count matches the topology. It is the count that
  carries that guarantee, not the indexing on its own.
- Existing deployments keep their boundary: both fields are optional, and at
  the default the header must still carry exactly one entry. One thing does
  change for everyone — entries are trimmed before they are read, so a single
  entry padded with spaces is accepted where it was refused.
- A misdeclared topology that leaves the header too short is refused, and the
  log says which declaration did not match.

### Bad

- **A second ingress path defeats the hop count, and the peer check is no
  longer there to catch it.** A Cloud Run service is reachable on its `run.app`
  URL as well as through the load balancer, and the two paths append different
  numbers of entries. With the peer check disabled by declaration, nothing
  distinguishes them, so a caller reaching the direct URL with their own
  `x-forwarded-for` lands in the silent case below: the framework reads an entry
  they control and uses it as the rate-limit key. Declaring a platform-enforced
  boundary is therefore only honest when the platform admits exactly one path —
  for Cloud Run that means ingress restricted to internal and load-balancer
  traffic, with the default URL disabled. That is a precondition of the
  declaration, not a recommendation beside it.
- **A declared platform-enforced boundary is unverifiable.** The framework
  cannot tell a deployment that genuinely sits behind an enforced ingress from
  one that has simply switched the peer check off. Nothing in the framework will
  detect the difference, and the request that exploits it looks exactly like a
  legitimate one.
- **A wrong hop count fails in both directions, and the dangerous one is the
  count that is too high.** Declaring more hops than exist refuses the caller
  who sends no prefix of their own. That is loud, and it is what an operator
  meets first. But it *serves* the caller who does send a prefix, reading their
  value as the client address, because the prefix shifts it into the position
  being read. Loud for honest traffic, quiet for the attack: that is the failure
  to guard against. Declaring fewer hops than exist reads an address the
  infrastructure appended, so every caller collapses onto one rate-limit key.
  Bad, but visible, because the limit starts applying to everyone at once, and
  structurally incapable of selecting a value a caller chose. The count is the
  adopter's to get right and the framework cannot check it.
- Two more ways to configure the profile wrongly, in the profile whose whole
  job is to be a security boundary.
- Published content changes. `packages/framework/README.md` and
  `website/src/content/docs/examples.md` both document this profile, so adding a
  security field an adopter has to reason about brings the mandatory
  cognitive-accessibility review under ADR-0023 with it.
- The deployment profile's meaning now depends on facts recorded outside the
  repository, in the adopter's platform configuration.
- **The two additions ship independently, and the hop count alone does not
  resolve the report.** A deployment whose proxy has no stable address still
  cannot construct a server until `proxyBoundary` lands, so the reporting
  deployment gains nothing from the hop count on its own. Public wording about
  the hop count has to say so, or an adopter upgrades, meets the same
  construction failure, and reads a partial fix as a broken one.

### Neutral

- The CIDR rejection invariant and its two black-box tests are unchanged.
- `loopback` is unchanged.

## Performance Review

`validateProductionRequest` sits on the ordinary JSON request path, which
ADR-0014 budgets.

Source: **no data - worst-case assumption**.

- Per request: one `split(",")` over a header of roughly 45 bytes, one `trim()`
  and one index computation. About 0.001 ms of framework CPU and about 0.25 KiB
  of transient allocation. No added network bytes. Under
  `proxyBoundary: "platform-enforced"` the peer path loses one `normalizeIp`
  call and one `Set` lookup, so that direction is a small saving.
- Retained memory is unchanged: the rate-limit key is still one normalized
  address and `maxClients` still bounds the map.
- Frequency: 100 requests a second, which is ADR-0014's qualification floor and
  the assumption ADR-0087 and ADR-0088 use for this same POST `/mcp` path.
- Daily aggregate: about 8.6 CPU-seconds and about 2.1 GiB of cumulative
  transient allocation, and no added network bytes.
- Against ADR-0014's budget of 5 ms p95 framework CPU and 256 KiB p95 transient
  allocation per request, both are three orders of magnitude inside.

The planning verdict is **PASS** against ADR-0014. A measured benchmark must
still pass before release.

## Confirmation

- A profile with neither `trustedProxyAddresses` nor `proxyBoundary` is refused
  at construction, and so is one carrying both.
- A profile declaring `proxyBoundary: "platform-enforced"` starts, serves a
  request from any peer, and still refuses a disallowed authority, a disallowed
  origin, a non-HTTPS forwarded protocol and a rate-limited client.
- `trustedProxyAddresses` still rejects a CIDR at construction.
- With `forwardedHops` unset, a multi-entry `x-forwarded-for` is refused,
  exactly as today.
- With `forwardedHops: 1`, both `<client>, <balancer>` and
  `<caller-supplied>, <client>, <balancer>` rate-limit on `<client>`, and a
  caller who varies their own prefix is limited on the same key.
- With `forwardedHops: 1`, a single-entry header is refused, the response
  carries the same generic message as every other forwarding refusal, and the
  server's log record names the hop-count mismatch.
- A count one higher than the topology reads the caller's own prefix as the
  client address, and serves the request. That is the accepted silent failure
  named in Consequences, not a guarded case: refusing an over-long header
  instead would break the prefix-ignoring this decision depends on. A behavioural
  test pins the direction, so prose that states it backwards contradicts a
  passing test rather than standing unchallenged.
- `forwardedHops` rejects a negative, fractional or non-numeric value at
  construction.
- A request carrying `x-forwarded-for` twice is refused at every hop count, so
  a caller cannot shift the index by repeating the field.
- A configuration file carrying `proxyBoundary` or `forwardedHops` loads, and
  one carrying an unknown key is still refused.
- A server started with `proxyBoundary: "platform-enforced"` records once at
  startup that the peer check is disabled by declaration.
- A loaded profile still equals the configuration file it came from, so the
  hop-count default is not materialized by the loader.

## Reassessment Criteria

Revisit:

- If a platform that appends a varying number of entries needs supporting, since
  a fixed count is the wrong control for it.
- If a way to verify a platform-enforced boundary becomes available, in which
  case the declaration should become checkable rather than trusted.
- If the adopter's header is measured and carries a single entry, since this
  record would then not have addressed issue 120 and the real cause would still
  be open.
- If a deployment is found serving on a declared boundary it does not have.
- If a platform that admits a second ingress path is found declaring a
  platform-enforced boundary, since the hop count is calibrated for one path and
  the peer check is no longer there to tell them apart.
- If the rate-limit key needs to be something other than a client address.

## Related

- Issue 119 reports the construction failure and argues for the platform-
  enforced boundary over accepting a CIDR. This record takes that argument.
- Issue 120 reports the multi-entry refusal and argues against taking the first
  entry. This record takes that argument too, and the reason it gives is why
  options 2 and 3 are rejected here.
- ADR-0068 and ADR-0078 build on `production-behind-proxy` for protected
  progress and for the example containers. Neither depends on how the peer or
  the client address is established, so both are unaffected: ADR-0068 orders
  the proxy and forwarding checks before authentication, which this record does
  not change, and ADR-0078's journeys keep `trustedProxyAddresses`.
- ADR-0078 says the examples teach the complete safe deployment path. This
  record does not extend them to the declared-boundary path. The examples keep
  demonstrating an address allowlist, which is the checkable option and the
  right default to teach; covering the declared path is deliberately out of
  scope here and would need its own decision, because teaching it means
  teaching the ingress precondition with it.
- `tests/black-box/production-boundary.test.mjs` and
  `tests/black-box/deployment-environment.test.mjs` pin the CIDR rejection this
  record preserves. The first of those also pins the multi-entry refusal that
  `forwardedHops` defaults to keeping.
- The session that reported issue 120 wrote a complete, tested implementation of
  the hop-count half in the `issue-120` worktree, on branch
  `claude/issue-120-forwarded-hops`, and reached the same shape independently:
  the same end-relative indexing, the same default, and the same refusal when
  the header is shorter than declared. This record follows its field name. It
  has not been run against a measured header either.
