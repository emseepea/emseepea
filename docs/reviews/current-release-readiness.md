# Current Release Readiness

Date: 2026-10-09

## Authenticated private resource inventory

Issue #146 adds bounded, caller-specific metadata listing to protected resource
templates through an optional `list` callback. The whole `resources/list`
method becomes authenticated when inventory is configured. Other methods and
applications without callbacks keep their existing access rules.

Callbacks receive the same validated principal as reads. A verifier may supply
an optional stable subject for users sharing an OAuth client. Tokens and raw
claims are not exposed. Authorization excludes inaccessible sources before
backend work. Reads must recheck ownership, retention, deletion, and access.

Cursors are encrypted and bound to the caller, permission view, catalogue,
and process. They expire fifteen minutes after the first page without renewal.
Pages query live records; insertions behind the cursor may be missed. This is
not a snapshot, durable outbox consumer, list-change notification, or verified
native ChatGPT Sources integration.

## Planned package set

- `@emseepea/server@0.23.0`
- `@emseepea/create-api-backed-server@0.1.9`
- `@emseepea/create-database-schema-server@0.1.9`
- `@emseepea/create-html-ui-server@0.1.9`
- `@emseepea/create-mongodb-backed-server@0.1.9`
- `@emseepea/create-multi-instance-postgres-server@0.1.9`
- `@emseepea/create-openapi-backed-server@0.1.9`
- `@emseepea/create-progress-streaming-server@0.1.9`
- `@emseepea/create-react-ui-server@0.1.9`
- `@emseepea/create-resources-and-prompts-server@0.1.9`
- `@emseepea/create-soap-backed-server@0.1.9`
- `@emseepea/create-tool-server@0.1.9`
- `@emseepea/feedback@0.8.3`
- `@emseepea/react@0.4.7`
- `@emseepea/svelte@0.2.7`
- `@emseepea/testing@0.21.7`

The dependent package patches adopt the new server version. All eleven
initializer patches update their generated dependency pins. The private
website version moves to 0.0.9 to publish the inventory guide and examples.

## Architecture and jobs to be done

Tom Howard ratified ADR-0115 on 2026-10-09 and authorized implementation and
release. It supplements ADR-0064 and ADR-0080 with a narrow opt-in inventory
exception. JTBD-002 and JTBD-100 cover the server and client interaction;
JTBD-101 covers checked publication. No new persona or job is needed.

## Required checks and residual risk

Public-boundary tests cover real clients, owner isolation for a shared OAuth
client, zero unauthorized backend calls, mixed source access, tampering,
permission changes, process binding, fixed expiry, live concurrent writes,
record revocation, count and byte limits, deadlines, and legacy compatibility.
The same inventory checks run against fresh packed installs.

Full exact-commit qualification must pass, including build, types, protocol,
packed installs, generated initializers, and documentation checks. Source
Quality must pass on Node.js 22 and 24, along with vulnerability scanning,
initializer qualification, and existing performance budgets. Release must pass
semantic checks and verify registry integrity, signatures, provenance, and
fresh installs. Publish must verify latest, write release records, deploy the
website, and merge back to main. Failed semantic trials are not retried.

Application query correctness remains the main risk: adapters must use bounded
queries, apply record policy, and maintain unique immutable ASCII ordering
keys. Protocol checks reject malformed pages but cannot establish a backend's
ownership policy or ordering history. Documentation makes these obligations
explicit. Process-local cursors require routing to the same instance or a
fresh listing after restart. Residual risk is within the Low appetite,
conditional on all required exact-commit gates.

## Conditional release readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full exact-commit qualification,
  Source Quality, Release, and Publish pass.
