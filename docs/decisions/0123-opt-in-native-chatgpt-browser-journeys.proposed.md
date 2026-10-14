---
status: "proposed"
date: 2026-10-13
human-oversight: confirmed
oversight-date: 2026-10-14
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-13
---

# Opt-in Native ChatGPT Browser Journeys

## Context and Problem Statement

Issue #145 needs evidence from the actual ChatGPT web experience, including
attachment, Model Context Protocol (MCP) invocation, application card, saved
state, and fresh retrieval.
A local host simulator or command-line model cannot establish that experience.
Framework adopters must be able to keep browser testing disabled.

## Decision Drivers

- Require explicit opt-in without changing ordinary framework tests.
- Keep account login, multi-factor authentication (MFA), consent, and endpoint
  ownership with the adopter.
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

An adopter may instead use one of two owner-controlled attachment paths:

- Supply an already-authorized Playwright page.
- Attach through Playwright's existing Chrome DevTools Protocol (CDP)
  implementation.

The attach command accepts only a literal loopback browser WebSocket with a
bounded address and port. The adopter must confirm that the browser owner matches
the account owner.

The adapter opens a separate test tab, closes that tab, and disconnects without
closing the owner browser. It never reads cookies or storage state. It also does
not implement CDP or browser semantics, login automation, CAPTCHA handling,
stealth flags, or remote-debugging setup.

Bounded Node WebSocket framing supplies Playwright's documented transport
interface and rejects redirects. Playwright preserves the owner's browser
defaults. The ordinary headed setup preserves Chromium's sandbox.

The adapter can attach only to a browser that the owner has already enabled and
approved in Chrome on the same host. This keeps the browser local. It does not
expose a desktop browser to the cloud runner or create a remote-access service.

For Chrome's graphical remote-debugging interface, the adapter admits both the
usual browser-ID path and the `/devtools/browser` path without a browser ID.
Both paths must use literal loopback.

Adopters declare ownership of account, HTTPS endpoint, synthetic fixtures, and
cleanup. Their scenario controls assertions, server collection, and cleanup.
Server evidence must be authenticated and correlated to the specific run.
User-agent text is insufficient to establish native client identity. Missing
identity or observations produces incomplete evidence. Document Object Model
(DOM) selectors are replaceable because the public ChatGPT interface can change.

Evidence is limited to hashes, fixed categories, and explicitly selected card
images. Images need their own content review.

Each live run must meet these evidence rules:

- Every submitted turn has a server observation before another turn begins.
- Fresh retrieval uses a new conversation identifier and independent server evidence.
- Durable state has an independent state assertion.
- Cleanup confirms that fixtures and conversations were removed, including after failure.
- A fresh conversation does not reset account memory.

## Consequences

The adopter owns an optional browser dependency, local authenticated profile,
endpoint, observability boundary, assertions, and retention. Local contract
tests and Chromium fixture tests prove only that the adapter behaves as designed
in controlled tests. They do not prove that the adapter works in a live ChatGPT
account. The #145 live journey is qualified per capability. A successful tool
result or returned resource link does not prove that ChatGPT completed a
subsequent resource read. Missing or rejected native reads remain incomplete
evidence even when deterministic protocol qualification succeeds.

## Confirmation

- The user authorized implementation and explicitly required framework opt-in.
- Scripted-page and intercepted Chromium tests verify the implementation boundary.
- A live authorized ChatGPT account connected to a disposable local HTTP MCP
  through an HTTPS tunnel. Native discovery, attachment submission, fresh
  retrieval, MCP App invocation, owner-isolation denial, and in-flight
  cancellation produced correlated server evidence.
- ChatGPT issued two `resources/read` requests for tool-returned resource links
  but reported both as `Unknown resource`. Deterministic protocol reads of the
  same resources succeeded. The native resource slice therefore remains
  incomplete and is not reported as a framework resource success.

- A reported security-verification loop in the automation-launched browser
  motivates the owner-session attachment alternative. Attachment uses a
  supported browser interface; it does not claim to resolve or bypass the
  verification service. A normal browser without an exposed authorized
  interface cannot be controlled by this adapter.
