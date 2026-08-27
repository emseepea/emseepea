# Em See Pea

Em See Pea is a general-purpose framework for Model Context Protocol (MCP)
`2026-07-28` servers over Streamable HTTP.

The project is pre-alpha. It currently supports a small, tested server surface;
it does not claim complete MCP coverage.

## What Works Now

- public and OAuth-protected tools
- checked direct and mapped backend calls
- static resources and non-enumerating resource templates
- prompts and opt-in completion
- bounded, loopback-only POST streaming progress
- JSON fallback for streaming tools
- Fastify-first HTTP serving on Node.js 22 and 24

The bounded streaming slice passed its
[Node.js 22 and 24 qualification run][streaming-quality]. Production and
intermediary streaming are not implemented. The protected example still
requires exact-commit quality and authoritative semantic qualification.

## Verify It Locally

```sh
npm ci --ignore-scripts
npm test
```

This required check builds every workspace and tests the public MCP boundary
through the real Fastify endpoint.

It covers:

- anonymous discovery and public listing
- public tools, resources, prompts, templates, and completion
- protected calls failing before handler execution
- checked backend results and redacted failures
- loopback streaming progress through raw HTTP and the official MCP client

For detailed gates and evidence, see the [quality policy][quality-policy] and
[0.0.1 release-readiness review][release-readiness].

## Run an Example

Build the workspaces first:

```sh
npm run build
```

Then choose one example:

- `npm run start:basic` - direct public tool
- `npm run start:backend` - mapped backend report
- `npm run start:protected` - public discovery with protected inventory data
- `npm run start:resources-prompts` - resources, templates, prompts, and completion
- `npm run start:streaming` - loopback streaming progress with JSON fallback

The protected example uses the public synthetic token `example-access-token`.
It demonstrates the verifier boundary only; it is not production OAuth.

## Check Whether a Language Model Understands the Results

```sh
npm run test:eval
```

This local advisory Promptfoo gate checks whether a language model interprets
each live example result correctly. Returning valid JSON is not enough.

The authoritative release gate uses GitHub Copilot CLI on the exact commit. It
remains pending and fails closed.

## Run the Provisional Performance Check

```sh
npm run benchmark
```

This measures the current JSON boundary. It does not make a performance claim
for backends, protected paths, resources, prompts, completion, or streaming.

## Current Security Boundary

The framework checks bearer-token expiry, required scopes, and resource
matching through the official software development kit (SDK) boundary.

Adopters remain responsible for:

- validating token integrity and issuer
- independently bounding or cancelling network and file operations started by
  the verifier
- object and tenant authorization
- safe outbound HTTP policy

The `server/discover` and `tools/list` operations remain public even when a tool
requires authorization.

## Not Implemented Yet

- effects, transactions, retries, or idempotency
- template enumeration, protected resources, or protected prompts
- pagination or configurable cache hints
- production or intermediary streaming
- subscriptions, replay, sessions, or resynchronisation
- shared state or multi-instance guarantees
- React, Tailwind, or native approval UI packages
- full active server-surface conformance

Publication does not expand these claims.

## Project Documents

- [Battle plan](BATTLE-PLAN.md)
- [Quality policy][quality-policy]
- [Release-readiness review][release-readiness]
- [Risk register](docs/risks/README.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.proposed.md)
- [Public discovery and protected invocation][public-discovery]
- [Semantic example qualification][semantic-qualification]
- [Cognitive-accessibility publication rule][cognitive-publication]
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

The source and examples are public under MIT. The root and examples remain
private npm workspaces. Only `@emseepea/server` is eligible for publication.

[cognitive-publication]: docs/decisions/0023-mandatory-cognitive-accessibility-review-for-published-content.proposed.md
[public-discovery]: docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md
[quality-policy]: QUALITY.md
[release-readiness]: docs/reviews/0.0.1-release-readiness.md
[semantic-qualification]: docs/decisions/0022-harness-mediated-semantic-llm-qualification-for-examples-and-releases.proposed.md
[streaming-quality]: https://github.com/windyroad/emseepea/actions/runs/33070295308
