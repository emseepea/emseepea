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

# Atomic Events Publication with Durable Source Identity

Tom Howard explicitly ratified this decision on 16 October 2026 after the two
reviewed contracts were presented together. The reviewed contract SHA-256 was
`cba309eac02e8a6e1b5d17ccdb04d69d38c6616344cb6f74ec65d68b87689683`. Human
oversight is confirmed; proposed status records that successful actual
production use is not yet evidenced.

This record does not claim implementation, publication or acceptance.

## Context and Problem Statement

A saved feedback reply and its pending notification currently cross separate publication steps. Re-reading subscribers after commit can change the audience, while a new publication ID on retry can create duplicate delivery intents. Issue #174 requires a supported configuration path rather than an adopter-written bridge.

## Decision Drivers

- Save a business change and its eligible delivery intents atomically.
- Keep stable identities through retry, crashes and completed work.
- Preserve caller transaction ownership and current authorization checks.
- Keep receipt privacy, deletion and replay-protection limits explicit.

## Considered Options

1. **Atomic publication with durable source identity (chosen)** — Record the source receipt and eligible intents in the business transaction.
2. **Post-commit outbox consumption with current subscriber lookup** — Keep today's split boundary and let retries select a potentially different audience.

## Decision Outcome

Chosen option: **"Atomic publication with durable source identity"**, because source changes and their fixed notification outcomes must survive failure together.

Choose an optional PostgreSQL publication boundary that records the source
event and its eligible delivery intents in the same transaction as the
business change. Reuse the feedback backend's existing outbox for feedback; do
not add a second authoritative feedback history. The existing basic server
remains unchanged.

Existing publish callers retain their documented behavior; the new opt-in
durable composition must not silently claim those callers are idempotent.

The alternative of consuming the existing outbox and looking up today's
subscriptions after commit is rejected for this supported composition: a crash
can lose the handoff, replay can change the audience, and random publication IDs
can create repeated effects. A generic distributed transaction across external
providers is not offered.

## Identity, audience and transaction contract

### Source identity

Source identity is scoped by deployment namespace, source kind and immutable
source-event ID.

Distinct business versions are distinct events even when contents match.

A canonical stored fingerprint binds event name, owner scope, payload and
source version.

Identical replay returns the recorded outcome; changed content under the same
identity fails closed before enqueue.

### Callback and delivery identity

Callback event identity is derived stably from the namespace/source/event key.

Delivery identity binds that key to one subscription generation.

All attempts retain both IDs; source identity, delivery ID and callback event
ID are distinct.

### Audience and subscription generations

Persist a source receipt even when no eligible subscription exists.

Recovery never expands that event's committed audience.

Each intent binds source identity to a subscription generation; renewal
preserves generation, while unsubscribe followed by a new subscription, or
reactivation after expiry, creates a new generation.

Owner, namespace, event, filter and callback URL are immutable within a
generation; changing them requires a new subscription.

Only pre-expiry renewal and authorized secret rotation preserve generation.

An old event cannot attach itself to that later generation.

### Transaction snapshot

Serialize publication of one source identity using a unique ledger key.

The eligible database subscription set is read in the same transaction under
its REPEATABLE READ snapshot (SERIALIZABLE is also permitted).

Owned transactions select this isolation; caller-owned transactions must
already provide it and are rejected otherwise, never silently reconfigured.

Eligibility means visible and unexpired at that snapshot, not all
subscriptions committed before the source transaction commits.

Concurrent later subscription changes cannot expand the snapshot.

Generation/expiry changes and deletion observed before sending may suppress
delivery.

Serialization failures require retry of the whole source transaction with the
same source identity.

Record immutable subscription-generation references, not copied callback
secrets.

### Authorization

Business authorization is adopter-owned and may depend on external state; it
is not claimed to share the SQL snapshot.

Eligibility is an upper bound.

Checked delivery must re-read the current subscription and authorization and
can only remove recipients, never add them.

A committed intent is not proof that its recipient is still authorized.

### Caller-owned transactions

Offer an explicit caller-owned transaction API.

It does not BEGIN, COMMIT, ROLLBACK, release the client or change caller
session settings.

Errors propagate and the caller must roll back before continuing; no post-failure success is returned.

The packaged feedback composition uses the already-owned backend transaction
to append the reply, outbox event and intents before commit.

Network callbacks and task scheduling never occur inside that transaction.

### Owned transactions

SQL atomicity covers data and intents, not external effects.

The adapter's owned-transaction convenience API may manage its own
transaction, with that ownership explicit and separate from the caller-owned
API.

## Completion, retention and deletion

Delivery completion retains a minimal deduplication receipt so the same source
and subscription generation cannot become pending again after success or a
terminal outcome. No automatic completed-receipt time-to-live (TTL) is
supplied. Callback URLs, secrets and reply bodies are excluded from minimal
receipts and logs.

Receipts contain source keys, generation references, fingerprints and terminal
categories; these can be linkable personal data, not anonymous telemetry.
Restrict access to the configured namespace and authorized runtime/maintenance
roles.

They are not exposed in public diagnostics; explicit erasure removes them and
ends the corresponding replay protection, so the adopter must also stop replay
of erased source identities. No claim of both complete erasure and permanent
dedup is made.

Source deletion cancels pending intents and removes source payloads;
subscription deletion cancels its pending intents and removes callback
credentials. Preserve minimal suppression/dedup identity where replay remains
possible.

Namespace purge is explicit, requires the adopter to stop writers and external
replay, and states that erasing dedup history ends replay protection.
Retention and privacy policy remain adopter decisions; cleanup must not
silently revive work.

## Guarantees and qualification

Delivery attempts are bounded and duplicate-tolerant; successful receipt is not guaranteed. A crash or ambiguous HTTP result
can cause a repeated callback with the same event ID. Durable enqueue dedup does
not promise exactly-once webhooks, client work or business effects.

Qualify PostgreSQL 17 with explicit migrations and restricted runtime privileges,
concurrent independent processes, identical and conflicting replay, zero-audience
replay, caller rollback and failure, crash windows, renewal and new generations,
source/subscription deletion, tenant isolation, completed dedup and explicit
retention boundaries. Public examples use only synthetic data.

## Consequences

### Good

- A committed change has a durable, recoverable notification outcome, including no recipients.
- Repeated publication preserves identity and does not recreate completed intents.

### Neutral

- Existing publication callers retain their documented behavior; the stronger contract is opt-in.
- Delivery-time authorization may reduce the recorded audience.

### Bad

- PostgreSQL transaction isolation and subscription generations become explicit integration constraints.
- Retaining linkable deduplication receipts creates privacy and maintenance responsibilities.
- Erasing receipt history ends the corresponding replay protection; ambiguous callbacks can still repeat external effects.

## Pros and Cons of the Options

### Atomic publication with durable source identity

- Good: commits the source change and durable notification outcome together.
- Bad: requires transaction participation, receipt retention and migration support.

### Post-commit outbox consumption with current subscriber lookup

- Good: reuses the existing consumer unchanged.
- Bad: cannot preserve the original audience or completed-intent identity without additional adopter logic.

## Confirmation

- The business change, source receipt and frozen eligible intents commit together, including a durable zero-recipient outcome.
- Identical replay preserves source, delivery and callback identities; conflicting replay fails closed.
- Caller-owned transactions retain ownership; renewal, new subscription generations, expiry and deletion respect the recorded audience.
- Completed intents do not become pending again within the retained replay-protection boundary.
- Privacy erasure and replay-protection limits remain explicit; delivery-time authorization can only narrow eligibility.
- Successful actual production use demonstrates these properties before the decision becomes accepted; synthetic tests, CI and publication alone do not establish acceptance.

## Reassessment Criteria

Reassess if a source cannot participate in the selected database transaction, if required privacy erasure cannot be reconciled with the documented replay boundary, or if production evidence invalidates identity or snapshot assumptions. External-provider transaction alternatives require their own evaluated guarantees.
