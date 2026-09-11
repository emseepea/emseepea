<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/assets/emseepea-signature-horizontal-colour-on-dark.svg">
    <img src="docs/brand/assets/emseepea-signature-horizontal-colour-on-light.svg" alt="" width="420">
  </picture>
</p>

# Em See Pea

Em See Pea is a general-purpose framework for Model Context Protocol (MCP)
`2026-07-28` servers over Streamable HTTP.

The project is pre-alpha. It supports a small set of tested MCP server features.
It does not support the full MCP server protocol yet.

## What You Can Build Today

Use the current framework to create:

- a Fastify MCP server that runs on Node.js 22 or 24
- public tools that anyone can call
- protected tools, resources, prompts, and completions that authenticate before application code runs
- tools that call another service and check its response
- optional detailed feedback and protected support conversations backed by PostgreSQL, Firestore, GitHub Issues, or Zendesk
- resources, reusable resource addresses, prompts, and field suggestions
- bounded notifications when a registered resource changes
- clear names, descriptions, icons, and usage hints for clients to display
- a server that tells clients when a list or resource is safe to reuse
- public or protected tools that report live progress while work is running
- handlers that send bounded client-visible log messages when each request opts in
- capability modules discovered once at startup from an opt-in directory
- independently deployable server instances that share one PostgreSQL report store
- a server with a native HTML form, or the same form rendered with React and
  the Em See Pea stylesheet

Public and protected tools can also report progress behind a trusted proxy. See
[how to configure proxy progress](packages/framework/README.md#use-progress-behind-a-proxy)
and its [tested limits](docs/protocol-coverage.md#progress-updates).

Startup capability discovery is also supported. See
[how startup discovery works](packages/framework/README.md#discover-capability-modules-at-startup).

## Verify It Locally

```sh
npm ci --ignore-scripts
npm test
```

This builds every package and tests it through a real Fastify endpoint.

It covers:

- finding the server and listing what it offers without signing in
- using tools, resources, prompts, reusable resource addresses, and suggestions
- rejecting unauthorized calls before application code runs
- checking results from connected services without exposing private errors
- reporting progress through raw HTTP and the official MCP client
- filtering request-scoped client log messages through the official MCP client
- saving through one server process and reading the same state through another
- recording detailed feedback, appending support replies, and keeping client scopes separate

For detailed gates and evidence, see the [quality policy][quality-policy] and
[current release-readiness review][release-readiness].

## Create a Project

These commands use the pre-alpha initializer packages published on npm.
Replace `my-server` with an unused directory name:

- [One public tool](examples/tool-server/README.md): `npm init @emseepea/tool-server -- my-server`
- [A public web API](examples/api-backed-server/README.md): `npm init @emseepea/api-backed-server -- my-server`
- [An OpenAPI-described web API](examples/openapi-backed-server/README.md): `npm init @emseepea/openapi-backed-server -- my-server`
- [Resources and prompts](examples/resources-and-prompts-server/README.md): `npm init @emseepea/resources-and-prompts-server -- my-server`
- [Progress streaming](examples/progress-streaming-server/README.md): `npm init @emseepea/progress-streaming-server -- my-server`
- [An HTML form](examples/html-ui-server/README.md): `npm init @emseepea/html-ui-server -- my-server`
- [A React form](examples/react-ui-server/README.md): `npm init @emseepea/react-ui-server -- my-server`
- [Interchangeable instances sharing PostgreSQL](examples/multi-instance-postgres-server/README.md): `npm init @emseepea/multi-instance-postgres-server -- my-server`
- [Types and validation generated from PostgreSQL](examples/database-schema-server/README.md): `npm init @emseepea/database-schema-server -- my-server`
- [Schema-enforced and schemaless MongoDB collections](examples/mongodb-backed-server/README.md): `npm init @emseepea/mongodb-backed-server -- my-server`
- [A contract-validated SOAP service](examples/soap-backed-server/README.md): `npm init @emseepea/soap-backed-server -- my-server`

Each command creates a standalone app with `private: true` in `package.json`,
plus its lint, ordinary tests, and semantic tests. The two form starters also
include browser accessibility tests.

The resources-and-prompts semantic test checks the honest unselected resource
experience. Ordinary tests qualify those MCP contracts.

Each initializer package, README, changelog, and maintained source live together in the matching
[`examples/` directory](https://github.com/emseepea/emseepea/tree/main/examples).

Every initializer includes a production container build. Read
[how to run an example behind a trusted proxy](website/src/content/docs/examples.md#build-a-production-container).

Every starter is open by default. Its README and tests show how to add the same
typed authentication and observability extensions without choosing a different
template. Discovery stays public by default. It can be explicitly protected
and filtered by the authenticated principal's permissions when the catalogue
itself is sensitive.

After choosing a starter, add [`@emseepea/feedback`](packages/feedback/README.md)
when you need a detailed one-way observation or a durable support conversation.
The optional package composes through `additionalTools`, so it does not require
a separate application-shape initializer.

## Check Whether AI Chooses and Uses the Right Tool

```sh
npm run claude:prepare
npm run claude:login
npm run test:eval
```

These checks ask a language model questions about every running example. For
tool examples, the model must select the expected advertised tool before it can
interpret the result. The checks catch wrong tool choices and answers that look
plausible but misunderstand the data. Returning valid JSON is not enough.

Each example keeps its JavaScript LLM tests in `eval/`, separate from ordinary
tests in `test/`. See the [guide to writing AI tool-choice tests](packages/testing/README.md).

Skip `npm run claude:login` when Claude is already signed in on your computer.

The pull-request checks run the current JSON performance test on Node.js 22 and
24. Load and performance results come from CI, not a developer's computer.

## Current Security Boundary

The framework authenticates bearer tokens through an application-supplied
verifier and checks declared permissions before protected application code runs.

Adopters remain responsible for:

- checking that tokens are genuine and come from the expected issuer
- stopping slow network and file operations started during token checks
- deciding which records and organisations each person may access
- controlling which external addresses the server may contact

Discovery remains public by default, even when invoking a capability requires
permission. An application may explicitly protect discovery and show each
principal only the capabilities allowed by their permissions.

## Scope Boundaries

These are deliberate non-goals, not an implementation backlog:

- generic backend or provider retries, circuit breakers, or grouped effect
  orchestration; applications use custom code or an appropriate library with
  settings chosen for their own provider and workload
- a framework-supplied promise that repeated writes change an external service
  only once
- querying application records or expanding templates through `resources/list`
  or `resources/templates/list`; applications provide purpose-built search or
  list tools, then clients use `resources/read` for a selected URI
- changing catalogues while a server runs
- saved sessions, replay, or reconnect recovery
- shared operation across computers without an appropriate shared backend

Em See Pea does not yet claim full coverage of the active MCP server protocol.
Standard protocol gaps remain implementation work and are tracked separately in
the [protocol coverage ledger](docs/protocol-coverage.md).

Publication does not expand these claims.

## Project Documents

- [Documentation and the three ways to use Em See Pea](website/src/content/docs/index.md)
- [Getting started from source](docs/guides/getting-started.md)
- [Battle plan](BATTLE-PLAN.md)
- [Quality policy][quality-policy]
- [Release-readiness review][release-readiness]
- [Risk register](docs/risks/README.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.superseded.md)
- [Typed authentication and optional protected discovery][public-discovery]
- [Language-model understanding checks][semantic-qualification]
- [Optional feedback and support conversations](packages/feedback/README.md)
- [Cognitive-accessibility publication rule][cognitive-publication]
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

The source and examples are public under MIT. The monorepo root has
`private: true` in `package.json`. The published packages include the server,
testing helpers, React renderer, Tailwind stylesheet, and eleven example-backed
initializer packages.

[cognitive-publication]: docs/decisions/0023-mandatory-cognitive-accessibility-review-for-published-content.proposed.md
[public-discovery]: docs/decisions/0064-typed-authentication-with-optional-permission-shaped-discovery.proposed.md
[quality-policy]: QUALITY.md
[release-readiness]: docs/reviews/current-release-readiness.md
[semantic-qualification]: docs/decisions/0055-native-client-journeys-only-in-semantic-tests.proposed.md
