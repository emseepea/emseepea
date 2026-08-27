# Em See Pea

Em See Pea is a general-purpose framework for MCP `2026-07-28` servers over
Streamable HTTP.

The project is pre-alpha. The current locally qualified candidate slice is a Fastify-first MCP
server with JSON operations and opt-in loopback-only POST SSE progress, public
tools, invocation-scoped OAuth-protected
tools, checked backend adapters, public static resources, non-enumerating
resource templates, prompts, and synthetic read-only examples.
Configured prompt arguments and resource-template variables also support
checked, opt-in completion.
The candidate streaming additions remain pending exact-SHA Node.js 22/24 and
authoritative Copilot qualification.

## Operating Documents

- [Battle plan](BATTLE-PLAN.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.proposed.md)
- [Anonymous production boundary][production-boundary]
- [Public discovery and protected invocation][public-discovery]
- [Trusted pre-alpha release governance][release-governance]
- [Semantic example qualification][semantic-qualification]
- [Quality policy](QUALITY.md)
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

## Initial Technical Baseline

- Node.js 22 and 24
- TypeScript 6
- npm workspaces with one root lockfile
- `@emseepea/server` using Fastify 5
- Official MCP core, server, Node, and Fastify packages at 2.0.0
- Anonymous MCP and OAuth resource-server metadata discovery
- Per-tool public or OAuth-protected access with required scopes
- Basic, backend, resources-and-prompts, and streaming-progress examples importing only the public package

The source and examples are public under MIT. Only `@emseepea/server@0.0.1` is
eligible for initial npm publication under the `next` tag; the root and examples
remain private npm workspaces.

## Check the Current Boundary

```sh
npm ci --ignore-scripts
npm test
```

The test compiles every workspace, exercises the real Fastify HTTP endpoint
with raw requests, and calls it with the official client pinned to
`2026-07-28`. It covers discovery, tool listing and calls, validation,
cancellation, request limits, safe errors, loopback binding, and the explicit
single-instance anonymous profile behind a trusted HTTPS proxy. It also proves
that OAuth metadata, `server/discover`, and `tools/list` remain anonymous while
missing, invalid, expired, wrong-scope, wrong-resource, and timed-out protected
calls cause zero tool-handler calls. Mapped-tool tests prove independent public,
backend-command, backend-result, and final-output validation across memory and
file adapters, with one adapter call, shared deadlines, disconnect cancellation,
and redacted failures.
Resource and prompt tests prove exact capability advertisement, anonymous
listing and invocation even when OAuth is configured, exact static and
templated resource dispatch, URI-variable extraction, checked protocol results,
deadline-bounded prompt argument validation, bounded application results,
generic errors, and interoperability through the official client.
Completion tests additionally prove startup key validation, immutable handler
capture, sibling-context filtering, candidate and result validation, timeout and
disconnect cancellation, error redaction, anonymous access, disabled-method
rejection, and official-client interoperability for prompts and templates.
Streaming tests prove checked request-scoped progress, bounded event count and
notification-payload size, cancellation, terminal closure, authorization before streaming, JSON
fallback, POST SSE, and official-client progress callbacks in the loopback profile.

Run the local advisory semantic gate separately:

```sh
npm run test:eval
```

For each Promptfoo trial, the harness performs the exact live MCP operation with
the official client, then gives that bound result to a no-tools LLM. Three fresh
agent trials and three no-MCP judge verdicts per example require deterministic
critical facts and exact MCP path evidence. GitHub Copilot CLI with
`claude-sonnet-4.6` is the authoritative
exact-commit release gate; local Claude results are advisory.

Run the provisional JSON-boundary performance gate separately:

```sh
npm run benchmark
```

The OAuth slice validates bearer-token expiry, required scopes, and resource
using the official SDK boundary. The adopter's `OAuthTokenVerifier` remains
responsible for issuer and token-integrity validation and for independently
bounding or cancelling its own I/O. Object or tenant authorization, safe
outbound HTTP policy, retries, effects, template enumeration or protection,
pagination, cache-hint configuration, production SSE, subscriptions, replay,
transport backpressure or resynchronisation, shared state, React, and Tailwind
are not implemented or claimed by this slice. Publication does not
expand these claims.

[production-boundary]: docs/decisions/0002-anonymous-production-boundary.proposed.md
[public-discovery]: docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md
[release-governance]: docs/decisions/0019-public-pre-alpha-releases-through-npm-trusted-publishing.proposed.md
[semantic-qualification]: docs/decisions/0022-harness-mediated-semantic-llm-qualification-for-examples-and-releases.proposed.md
