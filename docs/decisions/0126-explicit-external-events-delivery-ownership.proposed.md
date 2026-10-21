---
status: "proposed"
date: 2026-10-16
human-oversight: confirmed
oversight-date: 2026-10-16
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review", "Risk review"]
informed: []
reassessment-date: 2027-01-16
---

# Explicit External Events Delivery Ownership

Tom Howard explicitly ratified this decision on 16 October 2026 after the two
reviewed contracts were presented together. The reviewed contract SHA-256 was
`433ad4dfc21a153df6ddd90aa6fe3cf0b9f6c3c48cc097b3547da4d60a158cad`. Human
oversight is confirmed; proposed status records that successful actual
production use is not yet evidenced.

This record does not claim implementation, publication or acceptance.

## Context and Problem Statement

Request-driven services may receive no CPU while idle or may scale to zero. The existing SDK interval cannot establish reliable delivery in that environment. Issue #174 requires packaged dispatch and recovery that retain the checked webhook boundary and do not compete with that interval.

## Decision Drivers

- Deliver while the request service is idle without introducing a new always-running service.
- Keep delivery, retries and recovery owned explicitly and bounded.
- Reuse the existing authorization, signing, address protection and lease boundary.
- Let adopters configure infrastructure instead of writing delivery machinery.

## Considered Options

1. **Explicit external ownership with optional Cloud Run/Cloud Tasks composition (chosen)** — Supply authenticated targeted delivery and mandatory scheduled recovery.
2. **Separately supervised always-running worker** — Package delivery in a dedicated process with continuously scheduled CPU.
3. **Keep only the request-process interval** — Retain the current deployment assumption.

## Decision Outcome

Chosen option: **"Explicit external ownership with optional task composition"**, because request-driven services need delivery that does not depend on idle process CPU.

Choose explicit internal or external delivery ownership. Existing callers keep
the internal default. The supported durable feedback composition opts into
external ownership: the request process creates no software development kit (SDK) delivery interval. Basic
servers acquire no worker or subscription behavior.

For the first complete path, select one deployable reference: PostgreSQL 17,
the existing authenticated request server on request-driven Cloud Run, an
explicitly authenticated bounded worker endpoint, Cloud Tasks delivery and
scheduled bounded reconciliation: finding committed work whose task dispatch
is missing.

This fits the known request-driven deployment constraint rather than
introducing a separate always-running compute service. The optional provider
adapter/recipe is separate from core Events; enabling Events does not require
a Google dependency for other deployments. No hosted service or general task
orchestration is introduced.

The packaged composition supplies target dispatch, reconciliation and the
checked worker handler. The adopter configures the existing application pool,
stable namespace, authorization module, queue, service identities, invoker
permissions, audience, schedule and deployment secrets; no queue SQL or
webhook dispatch code is required.

Ordinary request-serving authentication is not proof of worker invocation
authority. The worker route is explicitly enabled by this configuration, never
registered on a basic or merely Events-enabled server.

Compared with the process timer, this recipe adds an external task queue and
scheduled recovery invocations, but does not rely on CPU after a request ends.
A standalone always-running worker is not included in this first qualification.
Cloud deployment/account permissions and native qualification access are required
local capabilities, not facts established by source inspection.

## Targeted execution and recovery

Expose one checked targeted operation for a stable delivery ID, plus bounded
reconciliation/due-work discovery used by the packaged worker. IDs are not bearer
authority: the operation is bound to the configured namespace and trusted worker
identity, with current owner/source/subscription authorization rechecked.

### Invocation authentication

The initial HTTP adapter must validate OpenID Connect (OIDC) issuer, intended
audience and the configured service identity before lookup. Bind namespace
from trusted config, not caller-selected request data. The scheduled
reconciliation endpoint independently verifies its configured OIDC invoker and
audience and fixes namespace from trusted configuration.

Both endpoints reject invalid authority before database or callback work.

### Task body

The task body contains only the delivery ID;
that ID cannot select an arbitrary callback, tenant or server configuration.

Mandatory bounded reconciliation discovers committed due intents and restores
missing task dispatch. Normal Cloud Tasks invocation reaches targeted delivery
through the shared checked runtime. It also reconciles durable committed work
after restart. Scheduling failure cannot erase a committed intent, and
recovery cannot reconstruct a different audience.

Post-commit wakeups may reduce latency but are not the durability boundary.
The supported recipe owns this logic, not adopters.

### Retry ownership

Cloud Tasks owns invocation retries. The framework persists due-time and an
independent safety cap of at most four callback attempts per delivery, preserving
the existing maximum; it does not run an SDK retry timer.

### Attempt reservation

Before each send,
durably reserve one attempt under the current lease. A crash, cancellation or
ambiguous outcome after reservation consumes that attempt even if no callback
was received. Reservations are never reused; after four reservations, recovery
terminates the delivery without another send. This trades possible lost attempts
for an enforceable cap and does not guarantee receipt.

### Retry responses

An early, contended or retry-pending invocation cannot bypass due-time, active
lease or attempt caps. Transport failures and lost acknowledgments may repeat
invocation with the same delivery ID. Reconciliation repairs missing transport
work without resetting those durable limits.

Terminal/suppressed work is acknowledged without another callback; retry-pending work produces the adapter's documented retry response. Not-due,
completed, suppressed or foreign-namespace IDs produce no callback.

### Pause and resume

Pause stops new task dispatch and reconciliation scheduling; already dispatched
or in-flight invocations may still send callbacks. It is not instantaneous
cancellation. Resume and normal reconciliation recover eligible pending work.

### Terminal limits

The terminal policy is attempt-count-based (at most four callback attempts), additionally bounded by subscription
expiry, revocation/deletion and existing terminal HTTP outcomes (410 or 413).
There is no newly implied elapsed-time replay window; transport retry/retention
configuration must be documented and qualified independently.

## Leases, bounds and races

Claim only the targeted delivery immediately before processing; competing workers
share durable fencing. All state transitions use matching lease tokens. A stale
worker cannot complete, reschedule or resurrect reclaimed or terminal work.

Use a monotonic invocation deadline and propagated cancellation for owned SQL
and HTTP operations where the driver supports it. Set explicit per-stage
limits and reserve sufficient remaining lease time before authorization and
each send.

The concrete timing budget, supported clock assumptions and shutdown grace
must be validated together before implementation is accepted; an elapsed
Promise race alone does not prove cancellation of backend work. Do not renew
leases implicitly or expose an unbounded drain.

Before sending, re-read the current subscription and check expiry, generation,
source existence, owner access and callback protections. Revocation/deletion
observed by that check suppresses the send.

Concurrent revocation after the final check cannot retract an already-started
callback; report this boundary rather than promise instantaneous cancellation
of external effects. Abort/shutdown stops new claims and sends; already-started outcomes can remain unknown and are recovered with the same stable
identity after the lease expires.

Reuse verification, Domain Name System (DNS)/address checking at connection time, HTTPS hostname
verification, redirect rejection, exact-byte signing, payload/response caps and
all ADR 0109 security controls. Do not add an alternate raw-webhook path.

## Diagnostics and qualification

Return bounded categorical outcomes and safe correlation IDs for capture,
queueing, suppression, claim, callback attempt/acceptance, retry and terminal
outcome. Never include callback URLs, secrets, reply bodies or unnecessary
personal data. Callback acceptance is not native execution; native execution is
not proof that the person read the reply or the business effect succeeded.

Qualify normal automatic task dispatch and scheduled reconciliation with synthetic data, restart/crash and
competing workers, pause/resume, cancellation and timeout at every awaited
boundary, stale tokens, lease exhaustion, revocation/deletion races and complete
cleanup.

Independently observe an authorized supported ChatGPT subscription wake,
authoritative exact-thread retrieval and intended follow-up from a normal team
reply. Several authorized matching subscriptions may receive a reply; do not
promise one chat unless the filter actually identifies one chat. Include a
nonmatching subscription control.

No manually forced task run substitutes for automatic dispatch.

## Consequences

### Good

- Normal task dispatch and scheduled recovery can operate while request service CPU is idle.
- A packaged composition removes custom polling, leasing and webhook dispatch from adopters.

### Neutral

- Existing callers retain the internal default; provider-specific dependencies remain optional.
- Adopters retain infrastructure, service identities and business authorization policy.

### Bad

- The initial supported recipe adds queue, scheduling and invocation-permission configuration.
- Crashes can consume reserved attempts without successful receipt.
- Pausing new dispatch cannot retract callbacks already in flight.
- A successful callback response cannot establish native execution or a business effect.

## Pros and Cons of the Options

### Explicit external ownership with optional task composition

- Good: fits the known request-driven deployment and preserves one checked delivery path.
- Bad: requires authenticated task and recovery configuration and qualification.

### Separately supervised always-running worker

- Good: supplies a runnable independent process.
- Bad: adds continuously scheduled compute not established as suitable for the known deployment.

### Request-process interval only

- Good: needs no additional deployment resource.
- Bad: cannot establish delivery while the request process is idle or absent.

## Confirmation

- External mode creates no SDK delivery timer, while basic servers and existing internal-mode callers retain their documented behavior.
- Configured worker and reconciliation invocation require independent authenticated authority and fixed namespace before database or callback work.
- Normal task dispatch and scheduled bounded recovery deliver eligible committed intents while the request service is idle.
- Durable reservations, stable identities and fencing preserve the four-attempt cap through crashes, ambiguity and competing invocations.
- Pause, cancellation, deadlines and shutdown retain the documented in-flight limits and checked callback protections.
- Native client execution and business effects have independent evidence; callback acceptance is never substituted for them.
- Successful actual production use demonstrates the architecture before acceptance; synthetic qualification, CI and publication alone are insufficient.

## Reassessment Criteria

Reassess if supported deployment constraints change, if the provider cannot preserve the targeted authorization and attempt contract, or if production evidence invalidates lease, recovery or retry assumptions. Other providers and deployment modes require their own qualification.
