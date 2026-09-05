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
- tools that require a sign-in token before their code runs
- tools that call another service and check its response
- resources, reusable resource addresses, prompts, and field suggestions
- clear names, descriptions, icons, and usage hints for clients to display
- a server that tells clients when a list or resource is safe to reuse
- public tools that report live progress while work is running
- capability modules discovered once at startup from an opt-in directory
- two local server processes that share one SQLite report store
- a server with a native HTML form, or the same form rendered with React and
  the Em See Pea stylesheet

Public tools can also report progress behind a trusted proxy. See
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
- rejecting calls that need sign-in before their code runs
- checking results from connected services without exposing private errors
- reporting progress through raw HTTP and the official MCP client
- creating one stored report when two local server processes share a request ID

For detailed gates and evidence, see the [quality policy][quality-policy] and
[0.2.2 release-readiness review][release-readiness].

## Create a Project

These commands use the pre-alpha initializer packages published on npm.
Replace `my-server` with an unused directory name:

- [One public tool](examples/tool-server/README.md): `npm init @emseepea/tool-server -- my-server`
- [A public web API](examples/api-backed-server/README.md): `npm init @emseepea/api-backed-server -- my-server`
- [A sign-in protected tool](examples/sign-in-tool-server/README.md): `npm init @emseepea/sign-in-tool-server -- my-server`
- [Resources and prompts](examples/resources-and-prompts-server/README.md): `npm init @emseepea/resources-and-prompts-server -- my-server`
- [Progress streaming](examples/progress-streaming-server/README.md): `npm init @emseepea/progress-streaming-server -- my-server`
- [An HTML form](examples/html-ui-server/README.md): `npm init @emseepea/html-ui-server -- my-server`
- [A React form](examples/react-ui-server/README.md): `npm init @emseepea/react-ui-server -- my-server`
- [Two processes sharing SQLite](examples/multi-instance-sqlite-server/README.md): `npm init @emseepea/multi-instance-sqlite-server -- my-server`

Each command creates a private standalone project with its lint, ordinary tests,
and semantic tests. The two form starters also include browser accessibility
tests. Each initializer package,
README, changelog, and maintained source live together in the matching
[`examples/` directory](https://github.com/emseepea/emseepea/tree/main/examples).

The sign-in example uses the made-up token `example-access-token`. It shows
where token checking fits. It is not a production sign-in system.

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

The framework can check whether a bearer token has expired and whether it grants
the required permission for this server.

Adopters remain responsible for:

- checking that tokens are genuine and come from the expected issuer
- stopping slow network and file operations started during token checks
- deciding which records and organisations each person may access
- controlling which external addresses the server may contact

People can still discover the server and list its tools without signing in,
even when using a tool requires permission.

## Not Included Yet

- tools that write data, group changes, retry failed requests, or safely repeat
  the same write
- listing every possible resource address or requiring sign-in for resources and
  prompts
- changing catalogues while a server runs
- deployed progress streams from tools that require sign-in
- saved sessions, subscriptions, replay, or reconnect recovery
- shared operation across computers or a promise that retries change an
  external service only once
- full coverage of the active MCP server protocol

Publication does not expand these claims.

## Project Documents

- [Documentation and the three ways to use Em See Pea](website/src/content/docs/index.md)
- [Getting started from source](docs/guides/getting-started.md)
- [Battle plan](BATTLE-PLAN.md)
- [Quality policy][quality-policy]
- [Release-readiness review][release-readiness]
- [Risk register](docs/risks/README.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.superseded.md)
- [Public discovery and sign-in checks][public-discovery]
- [Language-model understanding checks][semantic-qualification]
- [Cognitive-accessibility publication rule][cognitive-publication]
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

The source and examples are public under MIT. The root remains private. The
server, testing helpers, React renderer, Tailwind stylesheet, and all eight
example-backed initializer packages are eligible for publication.

[cognitive-publication]: docs/decisions/0023-mandatory-cognitive-accessibility-review-for-published-content.proposed.md
[public-discovery]: docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md
[quality-policy]: QUALITY.md
[release-readiness]: docs/reviews/0.2.2-release-readiness.md
[semantic-qualification]: docs/decisions/0040-model-selected-tool-semantic-tests.proposed.md
