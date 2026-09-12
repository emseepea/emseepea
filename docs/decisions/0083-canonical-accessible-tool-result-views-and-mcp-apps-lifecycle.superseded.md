---
status: "proposed"
date: 2026-09-12
human-oversight: confirmed
oversight-date: 2026-09-12
decision-makers: ["Tom Howard"]
consulted: ["Architecture review", "Accessibility review"]
informed: []
reassessment-date: 2026-12-12
---

# Canonical Accessible Tool Result Views and MCP Apps Lifecycle

## Context and Problem Statement

`@emseepea/react` renders validated elicitation forms, while applications that
present structured tool results still copy semantic result markup and the MCP
Apps iframe lifecycle. A production adopter retains both a bespoke result card
and a host adapter after moving its server, tests, resource contract, and
initializer to Em See Pea.

This decision defines the smallest reusable result-view and browser lifecycle
surface that removes that generic code without turning Em See Pea into a design
system or moving domain decisions and effects into client presentation.

## Decision Drivers

- Let adopters supply validated domain data, wording, actions, and styles.
- Keep result semantics, status announcements, focus, and MCP Apps connection
  behavior consistent and independently testable.
- Preserve framework-neutral native and React rendering from ADR-0011.
- Keep browser and React dependencies out of servers without a user interface.
- Keep public data bounded, presentation-safe, and compatible under ADR-0006.
- Preserve schema-declared values unless mapping has a concrete reason under
  ADR-0050.

## Considered Options

1. **Canonical result view, native and React renderers, and a standards-first
   lifecycle hook** - Reuse the existing server UI and React packages.
2. **Result renderer with adopter-owned lifecycle** - Remove repeated result
   markup but leave every MCP App to implement the same iframe protocol.
3. **Low-level primitives and an example only** - Document semantic pieces but
   keep their composition and lifecycle in each adopter.

## Decision Outcome

Chosen option: **"Canonical result view, native and React renderers, and a
standards-first lifecycle hook"**.

`@emseepea/server/ui` owns a strict, bounded, presentation-only result-view
model, parser, and native HTML renderer. `@emseepea/react` owns an unstyled
semantic `ResultView` renderer and a small MCP Apps lifecycle hook. Both
renderers consume the same model and preserve the same loading, ready, updated,
empty, sending, sent, and error states.

The result model contains visible headings, a calculated headline, labelled
metrics, summaries, reasons or assumptions, a disclosure, a disclaimer, status
messages, deterministic focus targets, and optional action descriptors. It
contains no raw HTML, credentials, private host state, destination, request
authority, or effect authority. Strings render as text. Compatibility changes
follow ADR-0006.

Renderers use a caller-supplied embedded heading level, definition-list
semantics for labelled values, lists for reasons and assumptions, native
`details` and `summary` for disclosure, and native buttons for actions. They do
not create a document title, language, main landmark, H1, route, theme, or
design system. Stable `data-emseepea-part` hooks allow adopter styling without
carrying semantics or authority.

One polite status region exists from first paint and updates in place. Static
screen-reader-readable loading text is present before host data arrives.
Passive updates do not move focus. User-triggered blocking transitions use the
model's deterministic focus target. Visible action labels remain within their
accessible names.

The React lifecycle hook implements the MCP Apps `ui/initialize` and
`ui/notifications/initialized` exchange, receives tool results and cancellation,
merges checked host-context updates, and cleans up listeners, timeouts, and
pending requests. It accepts messages only from the embedding parent and checks
the JSON-RPC shapes it consumes. It exposes bounded theme and display context as
presentation inputs and can send a standard text message to the host.

Applications retain tool-output validation, mapping from domain output into the
result model, calculations, wording, action construction, effect handling,
authentication, routing, document structure, and styles. Em See Pea adds no
OpenAI-specific global or SDK, HTTP or authentication client, new package,
dependency, or Tailwind requirement.

## Consequences

### Good

- React adopters delete repeated result semantics and host lifecycle code.
- Native and React results share one validated public contract.
- Accessibility and hostile-input checks live at the reusable boundary.
- Servers without a user interface gain no front-end dependency.

### Neutral

- Adopters still map domain output and construct domain actions.
- The hook implements a narrow dependency-free subset of the MCP Apps protocol.

### Bad

- The public result model and styling hooks require compatibility review.
- Additional MCP Apps features remain adopter-owned until demonstrated demand.

## Confirmation

- Strict parsing rejects unknown, oversized, inconsistent, and authority-bearing
  result data.
- Native and React renderers pass shared fixtures for every result state.
- Hostile text cannot execute markup in either renderer.
- Embedded renderers emit no document shell, main landmark, or H1.
- Labelled values, lists, disclosure, disclaimer, and buttons retain native
  semantics with the stylesheet absent.
- The polite live region exists before updates and remains the same React node.
- Keyboard, focus, label-in-name, axe, forced-colors, reduced-motion, 320-pixel
  reflow, and target-size checks pass for the maintained example.
- The lifecycle hook completes initialization before accepting tool results,
  rejects malformed or foreign-source messages, applies checked theme and
  display changes, reports cancellation, and cleans up on teardown.
- The published packages and initializer pass fresh-install verification.
- A cited adopter replaces its generic result-presentation and host-lifecycle
  code while retaining only domain mapping, actions, and styles.

## Performance Review

This decision renders already-returned structured content and adds no server
endpoint, payload, cache, or per-request handler. It makes no UI asset
performance claim.

## Reassessment Criteria

Reassess when a second UI framework demonstrates demand, the MCP Apps extension
requires broader protocol coverage, consumers need a design system, or the
result model cannot express a demonstrated accessible presentation without
domain-specific fields.
