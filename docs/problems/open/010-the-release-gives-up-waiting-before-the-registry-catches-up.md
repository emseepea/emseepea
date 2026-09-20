# Problem 010: The Release Gives Up Waiting Before the Registry Catches Up

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 12 (High) — Impact: 4 × Likelihood: 3 — three published packages cannot resolve their own runtime dependency during the window, and the eleven starters carry pins that stop a freshly created project installing; those spans are deduced from published manifests and registry timestamps rather than observed. Observed once, and it depends on how slow the registry is on the day
**Origin**: internal
**Effort**: S (small) — this ticket is the wait, which is a loop count and an interval in one file, and that is what the backlog ranking prices. The third investigation task below, making a package set become visible together rather than in pieces, is larger and belongs in its own ticket once the decision is taken
**Jobs To Be Done (JTBD)**: JTBD-101 — a job to be done: publish installable packages safely
**Persona**: framework-maintainer

## Description

A release publishes its changed packages one at a time — sixteen of seventeen
on 2026-09-20 — and then waits for the registry to serve them all. It does not
wait long enough.

`waitForPublication` in `scripts/verify-registry-release.mjs` tries sixty times,
three seconds apart. That is three minutes. On 2026-09-20 the registry took
about five.

The timings from release run `35501810473`, attempt 1. The run identifier now
resolves to the successful second attempt, so the failure is only visible under
`/attempts/1`.

| Event | Time | Source |
|---|---|---|
| Publish step reports all sixteen successful | 09:37:05Z | run log |
| `@emseepea/create-react-ui-server@0.0.43` recorded, earliest looked-up package pinning a version still missing | 09:37:26Z | registry `time` |
| `@emseepea/feedback@0.3.0` recorded | 09:39:11Z | registry `time` |
| Verifier gives up: `partial` against `published` | 09:40:08Z | run log |
| `@emseepea/server@0.16.0` recorded | 09:40:50Z | registry `time` |
| `@emseepea/testing@0.16.2` recorded | 09:42:07Z | registry `time` |

Two packages have registry timestamps later than 09:40:08Z, so two were still
absent when the verifier stopped waiting. Both appeared on their own, 42 seconds
and 2 minutes later. Nothing failed to publish.

The registry's own timestamps are what date these. The only direct observation
of what was readable is the verifier's poll at 09:40:08Z, which found some of
the pending set present and some absent.

Re-running the failed job did not fix anything. Attempt 2's publish step logged
`No unpublished projects to publish.` at 10:09:54Z — 27 minutes after the last
package had already appeared. The re-run turned the release green. The window
had closed by itself long before.

The real cost is the window, not the red run, and it is wider than the gap the
verifier saw.

Three published packages could not resolve their own runtime dependency.
`@emseepea/react`, `@emseepea/svelte` and `@emseepea/feedback` each pin
`@emseepea/server` at exactly `0.16.0` in `dependencies`, and all three were
being served before it was. This is the consumer-facing breakage: an ordinary
`npm install` of any of them, runtime dependencies only, could not complete.

| Package | Recorded | Unresolvable until `@emseepea/server@0.16.0` at 09:40:50Z |
|---|---|---|
| `@emseepea/react@0.3.4` | 09:38:31Z | 2m 19s |
| `@emseepea/svelte@0.1.8` | 09:38:54Z | 1m 56s |
| `@emseepea/feedback@0.3.0` | 09:39:11Z | 1m 39s |

`@emseepea/testing@0.16.2` carries the same runtime pin but was recorded at
09:42:07Z, after `@emseepea/server`, so it was never in this state. The method
here is exhaustive rather than sampled: every package published in this batch
was checked for a runtime dependency on `@emseepea/server@0.16.0`, and these
four are all of them.

Separately, twelve packages pin `@emseepea/testing` at exactly `0.16.2` —
`@emseepea/feedback@0.3.0` and all eleven `create-*` starters. In every one of
those it is a development dependency, so an ordinary consumer install never
fetches it. What fails is an install inside a freshly created starter project.
The first of those twelve was recorded at 09:37:26Z and `@emseepea/testing`
itself at 09:42:07Z, so that window was about four and a half minutes.

A starter project fails on more counts than either of those, and for a reason
not visible in the published initializer. `scripts/build-initializer.mjs` builds
the template manifest a created project actually installs: it moves the
initializer's `starterDependencies` into the template's `dependencies` and
carries everything else through as development dependencies. So a generated
project depends on `@emseepea/server@0.16.0` at runtime, and on both
`@emseepea/testing@0.16.2` and `@emseepea/feedback@0.3.0` for development. The
React starter's template additionally takes `@emseepea/react@0.3.4` at runtime.
Four of those were missing for part of the window.

Both user-interface starters also list `@emseepea/tailwind` in
`starterDependencies`, so a project created from either takes it at runtime too.
That one was not affected: `@emseepea/tailwind` is the seventeenth package and
was not in this release, so the version a created project asks for was already
being served. It is named here because the enumeration above is meant to be
re-checkable, and a reader counting runtime dependencies would otherwise find
one the list does not mention.

The runtime-pin check was run across all seventeen entries in
`scripts/public-packages.mjs`, so it can be reproduced rather than trusted. Note
that a starter's own published manifest declares no runtime dependencies — what
a created project installs comes from `starterDependencies`, which is a
different list in the same file.

Two of the figures above are derived rather than observed, and the difference
matters in a ticket whose first version failed on exactly that. No install was
attempted during the window: the unresolvable spans are deduced from the
published manifests and the registry's timestamps. And the four-and-a-half-minute
figure starts from the earliest timestamp this ticket looked up, not from a
survey of all sixteen — so it is a lower bound on that window, not a measurement
of it.

## Symptoms

- The release fails at "Verify package publication" with
  `AssertionError: not all packages appeared after publication`, comparing
  `partial` against `published`.
- The publish step immediately above it reported every package as successful,
  and it was telling the truth.
- `npm view <package>@<version>` returns `404 No match found for version` for a
  few minutes and then starts working without anyone doing anything.
- A package already being served depends at runtime on a version that is not, so
  an ordinary install of it cannot resolve. Three packages were in this state,
  deduced from the published manifests and the registry's timestamps rather than
  from an attempted install.
- Other packages pin the missing version in `devDependencies`, so an install
  inside a freshly created starter project fails while an ordinary consumer
  install of the same package does not.

## Workaround

Wait a few minutes and check the registry directly. If every version is being
served, the publication succeeded and only the verification was early; re-run
the failed job to make the release green. Do not assume a re-run republishes
anything — it will report that there is nothing to publish.

## Impact Assessment

- **Who is affected**: anyone installing `@emseepea/react@0.3.4`,
  `@emseepea/svelte@0.1.8` or `@emseepea/feedback@0.3.0`, and anyone running
  `npm install` in a project just created from a starter. Creating the project
  succeeds — the initializer only copies a template — and the install it prints
  as the next step is what fails.
- **Frequency**: once observed, on 2026-09-20. It depends on how quickly the
  registry serves a newly published version, which varies.
- **Severity**: an install fails outright while the window is open. Nothing is
  exposed and nothing incorrect is served, and the window closes on its own.
- **Analytics**: release run `35501810473` attempt 1. The verifier's own poll at
  09:40:08Z is the only direct observation, and it reported some of the pending
  set present and some absent; that two were absent is deduced from the registry
  timestamps looked up. The earliest timestamp looked up was 09:37:26Z and
  `@emseepea/testing@0.16.2` was recorded at 09:42:07Z, so about four and a half
  minutes is a lower bound on the starter-install window rather than a
  measurement of it.

## Root Cause Analysis

The wait is three minutes and the registry took five. That is the whole of it,
and the number is in this project's own code:

```js
const waitForPropagation = () => new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
for (let attempt = 1; attempt <= 60; attempt += 1) { ... }
```

The same sixty attempts and three-second interval appear again in
`readProvenance`, which polls for attestations once the versions are present.
That one was never reached on this run, so whether it is also too short is
untested.

Two explanations are ruled out by the timings. The publishing tool and the
registry did not disagree — the tool reported success and every version did
appear. And the cause is not outside this project: the number that decided the
outcome is the sixty above.

There is a second thing worth deciding rather than inheriting. Publishing one
package at a time means the set becomes visible in pieces, so a slow registry
leaves published packages pinning an unavailable one. A longer wait shrinks the
red-run noise; it does not close the window during which installs fail.

### Investigation Tasks

- [ ] Raise the wait to something well past observed propagation, and record why
  that number.
- [ ] Make the failure say which it is — still propagating, or genuinely absent —
  so nobody re-runs a job that has nothing to publish.
- [ ] Decide whether a set should become visible together rather than in pieces,
  so a slow registry cannot leave a published package pinning an absent one.
- [ ] Create a reproduction test for the chosen wait behaviour.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: Problem 008 (The Release Package List Is Transcribed by
  Hand Into the Readiness Record). Both are the release holding a belief about
  its own package set that does not match what npm serves.

## Related

- `scripts/verify-registry-release.mjs` — `waitForPublication` holds the sixty
  attempts and the three-second interval, and the `partial` against `published`
  assertion.
- `.github/workflows/release.yml` — the "Create release pull request or publish"
  and "Verify package publication" steps, in that order.
- Risk R007, the release pipeline publishing the wrong or compromised package.
  The risk is adjacent rather than realised: nothing wrong was published, but
  parts of the published set could not be installed — at longest 2 minutes 19
  seconds for an ordinary install of `@emseepea/react@0.3.4`, and at least four
  and a half minutes for an install inside a freshly created starter project.
- Captured at the maintainer's direction immediately after the release that
  exposed it.
