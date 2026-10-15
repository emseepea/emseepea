---
status: "proposed"
date: 2026-10-14
human-oversight: confirmed
oversight-date: 2026-10-14
supersedes: ["ADR-0123"]
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "JTBD review"]
informed: []
reassessment-date: 2027-01-14
---

# Opt-in Native ChatGPT Browser Journeys with Bounded Archived Transcripts

## Context and Problem Statement

Native ChatGPT acceptance needs evidence from the actual web experience,
including attachment, Model Context Protocol (MCP) invocation, application
cards, saved state, fresh retrieval, authorization boundaries, and cleanup.
A local host simulator or command-line model cannot establish that experience.
Framework adopters must be able to keep browser testing disabled.

The first live acceptance run used synthetic material, a disposable plugin, and
a disposable local HTTP MCP. The plugin, endpoint, tunnel, server, and fixture
store could be removed. ChatGPT's local-conversation surface exposed Archive
but no authoritative permanent-delete operation. Archive removed both test
conversations from active navigation and produced authoritative
`archived: true` readback, but remained reversible retention. The architecture
must distinguish that retained state from deletion without leaving cleanup
indefinitely unverifiable.

## Decision Drivers

- Require explicit opt-in without changing ordinary framework tests.
- Keep account login, multi-factor authentication (MFA), consent, endpoint
  ownership, and retained conversations with the adopter.
- Combine browser assertions with authenticated server observations.
- Keep credentials, cookies, customer data, and private application data out of
  framework evidence.
- Fail closed when the native host does not expose an expected observation.
- Describe archived conversations as reversible retention, never deletion.
- Bound retained synthetic evidence when the native host has no authoritative
  permanent-delete operation.

## Considered Options

1. **Opt-in native journeys with bounded archived synthetic transcripts
   (chosen)** - Preserve the optional adopter-owned browser adapter and allow
   exact synthetic conversations to remain archived and inert only when the
   native host exposes no authoritative permanent-delete operation.
2. **Require permanent conversation deletion for every live run** - Keep the
   original cleanup rule even when the native host supplies no deletion
   surface, leaving the completed live journey unable to finish cleanup.
3. **Leave cleanup incomplete indefinitely** - Retain the conversations without
   a bounded retention rule or a later deletion trigger.

## Decision Outcome

Chosen option: **"Opt-in native journeys with bounded archived synthetic
transcripts"**, because it preserves real-host evidence and adopter ownership
while describing the only available conversation-cleanup state truthfully and
constraining its retention.

The testing package exposes a separate `/chatgpt` entry point, an optional
Playwright dependency, and explicitly enabled setup and execution commands.
Importing the adapter does not launch a browser. Ordinary tests stay unchanged.
The setup command opens a visible browser window, creates a dedicated local
profile, and requires human login and account confirmation. Authentication
state is never exported.

An adopter may instead supply an already-authorized Playwright page or attach
through Playwright's existing Chrome DevTools Protocol implementation.
Attachment accepts only a WebSocket browser-control address on the same
computer, using an explicitly limited loopback address and port. The adopter
confirms that the browser owner matches the account owner.
The adapter opens and closes a separate test tab and disconnects without
closing the owner browser. It never reads cookies or storage state and does not
implement login automation, CAPTCHA handling, stealth flags, browser semantics,
or remote-debugging setup.

The adapter uses Node.js to exchange size-limited WebSocket messages through
Playwright's documented transport interface. It rejects redirects so browser
control cannot be sent to another address. Playwright preserves the owner's
browser defaults. Ordinary visible-browser setup keeps Chromium's built-in
security sandbox enabled. Attachment remains on the same host and cannot create
a remote-access service. Attachment accepts only two local browser-control URL
patterns: the standard path containing a browser identifier, or
`/devtools/browser` without an identifier. Both patterns must use a literal
loopback address.

Adopters declare ownership of the account, HTTPS endpoint, synthetic fixtures,
retained conversations, and cleanup. Their scenarios control assertions,
server collection, and cleanup. Server evidence must be authenticated and
correlated to the specific run. User-agent text is insufficient to establish
native client identity. Missing identity or observations produces incomplete
evidence. Document Object Model selectors are replaceable because the public
ChatGPT interface can change.

Each live run must meet these evidence rules:

- Every submitted turn has a server observation before another turn begins.
- Fresh retrieval uses a new conversation identifier and independent server
  evidence.
- Durable state has an independent state assertion.
- A fresh conversation does not reset account memory.
- Cleanup removes the plugin, endpoint, tunnel, server, and fixture store.
- Conversations are permanently deleted when the native host exposes an
  authoritative operation.
- When permanent deletion is unavailable, only exact synthetic conversations
  may remain. They must be archived, verified as archived through an
  authoritative readback, owned by the dedicated account owner, inaccessible
  through an active plugin or endpoint, and described as retained rather than
  deleted.
- Retained conversations contain no credentials, customer data, or private
  application data. Bounded evidence omits raw transcripts, account identity,
  plugin identity, and endpoint location.
- Retained conversations remain accessible only within the dedicated owner
  account. They are not shared or exported.
- Evidence is limited to hashes, fixed categories, and explicitly selected
  card images. Every retained image receives its own content review.
- Archived synthetic conversations are reassessed at least quarterly and are
  permanently deleted when an authoritative deletion surface becomes
  available.

## Consequences

### Good

- Adopters can prove bounded native behavior without turning browser testing on
  for ordinary framework users.
- The evidence boundary distinguishes live native observations, deterministic
  protocol checks, missing observations, archive, and deletion.
- A missing host deletion feature does not force a false cleanup claim.
- Retained conversations are synthetic, inert, account-scoped, and subject to a
  concrete deletion trigger and quarterly review.

### Neutral

- The adopter owns the optional browser dependency, authorized session,
  endpoint, observability boundary, assertions, and retention review.
- Local contract tests and Chromium fixture tests prove only controlled adapter
  behavior. They do not prove a live ChatGPT journey.
- Archive is an available native-host state, not a framework storage feature.

### Bad

- Archived conversations remain recoverable and therefore retain data until a
  supported permanent-delete operation becomes available.
- The account owner must reassess retained transcripts at least quarterly.
- Public ChatGPT interface changes can require selector or evidence-path
  maintenance.

## Confirmation

- Scripted-page and intercepted Chromium tests verify the adapter boundary.
- A live authorized ChatGPT account connected to a disposable local HTTP MCP
  through an HTTPS tunnel. Native discovery, attachment submission, fresh
  retrieval, MCP App invocation, owner-isolation denial, and in-flight
  cancellation produced correlated server evidence.
- ChatGPT issued two `resources/read` requests for tool-returned resource links
  but reported both as `Unknown resource`. Deterministic protocol reads of the
  same resources succeeded. The native resource slice remains incomplete and
  is not reported as a framework resource success.
- The native host displayed the completed tool result but no intermediate
  progress updates. Native progress exposure remains incomplete.
- The disposable plugin was permanently deleted. The endpoint, tunnel, server,
  and fixture store are absent.
- Both exact synthetic conversations produced authoritative `archived: true`
  readback. This confirms reversible archive, not permanent deletion.
- The retained local evidence omits raw prompts, replies, account identity,
  plugin identity, and endpoint location.

## Pros and Cons of the Options

### Opt-in native journeys with bounded archived synthetic transcripts

- Good, because it preserves real-host evidence and a truthful cleanup boundary
  under the native host's current capabilities.
- Bad, because archived transcripts remain recoverable until deletion becomes
  available.

### Require permanent conversation deletion for every live run

- Good, because it minimizes retained data.
- Bad, because the native host currently exposes no authoritative deletion
  operation for these local conversations.

### Leave cleanup incomplete indefinitely

- Good, because it requires no additional governance.
- Bad, because it gives retained evidence no owner, review cadence, or deletion
  trigger.

## Reassessment Criteria

Reassess this decision at least quarterly, when ChatGPT adds an authoritative
permanent-delete operation for local conversations, when a retained transcript
is found to contain non-synthetic or private data, when account ownership or
access changes, or when archive readback no longer proves the expected state.
