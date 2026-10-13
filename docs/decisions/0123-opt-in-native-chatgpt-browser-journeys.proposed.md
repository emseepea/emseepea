---
status: "proposed"
date: 2026-10-13
human-oversight: pending
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-13
---

# Opt-in Native ChatGPT Browser Journeys

## Context and Problem Statement

Issue #145 needs evidence from the actual ChatGPT web experience, including
attachment, MCP invocation, application card, saved state, and fresh retrieval.
A local host simulator or command-line model cannot establish that experience.
Framework adopters must be able to keep browser testing disabled.

## Decision Drivers

- Require explicit opt-in without changing ordinary framework tests.
- Keep account login, MFA, consent, and endpoint ownership with the adopter.
- Combine browser assertions with authenticated server observations.
- Retain bounded evidence and require fixture and conversation cleanup.

## Considered Options

1. An optional Playwright adapter with adopter-owned scenarios and sessions.
2. Automatic browser login in default framework tests.
3. Treat simulator tests as proof of native host compatibility.

## Decision Outcome

Chosen option: **an optional Playwright adapter with adopter-owned scenarios
and sessions**, because it can exercise the visible journey while preserving
explicit ownership and opt-in execution.

The testing package exposes a separate `/chatgpt` entry point, an optional
Playwright dependency, and explicitly enabled setup and execution commands.
Importing the adapter does not launch a browser. Ordinary tests stay unchanged.
The headed setup command creates a dedicated local profile and requires human
login and account confirmation. Authentication state is never exported.

An adopter may instead supply an already-authorized Playwright page or attach
through Playwright's existing CDP implementation. The command accepts only a
literal loopback browser WebSocket, bounded address and port, and explicit
browser-owner confirmation matching the account owner. It uses a separate test
tab, closes that tab, and disconnects without closing the owner browser. It
never reads cookies or storage state and does not implement CDP or browser
semantics, login automation, CAPTCHA handling, stealth flags, or remote debugging
setup. Bounded Node WebSocket framing supplies Playwright's documented transport
interface and rejects redirects. Playwright preserves the owner's browser
defaults. The ordinary headed setup preserves Chromium's sandbox.

Chrome's GUI remote-debugging interface can use `/devtools/browser` without a
browser ID. Both that path and the usual browser-ID path are admitted on
literal loopback. The owner enables and approves debugging in Chrome; the
runner must operate on the same host. This does not expose a desktop browser
to the cloud runner or create a remote-access service.

Adopters declare ownership of account, HTTPS endpoint, synthetic fixtures, and
cleanup. Their scenario controls assertions, server collection, and cleanup.
Server evidence must be authenticated and correlated to the specific run.
User-agent text is insufficient to establish native client identity. Missing
identity or observations produces incomplete evidence. DOM selectors are
replaceable because the public ChatGPT interface can change.

Evidence contains hashes, fixed categories, and only explicitly selected card
images. Images need their own content review. Every submitted turn requires a
server observation before another turn begins. Fresh retrieval requires a new
conversation identifier and independent server evidence. Durable state requires
an independent state assertion. Cleanup must confirm fixtures and conversations
were removed, including after failure. A fresh conversation does not reset
account memory.

## Consequences

The adopter owns an optional browser dependency, local authenticated profile,
endpoint, observability boundary, assertions, and retention. Deterministic
contract and Chromium fixture tests establish adapter behavior only. They do
not establish live ChatGPT compatibility. The complete #145 journey remains
pending until account and endpoint owners supply live evidence.

## Confirmation

- The user authorized implementation and explicitly required framework opt-in.
- Scripted-page and intercepted Chromium tests verify the implementation boundary.
- Live account login, authenticated endpoint correlation, and full native journey
  evidence remain pending; this proposed decision records that limit.

- A reported security-verification loop in the automation-launched browser
  motivates the owner-session attachment alternative. Attachment uses a
  supported browser interface; it does not claim to resolve or bypass the
  verification service. A normal browser without an exposed authorized
  interface cannot be controlled by this adapter.
