<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/assets/emseepea-signature-horizontal-colour-on-dark.svg">
    <img src="docs/brand/assets/emseepea-signature-horizontal-colour-on-light.svg" alt="Em See Pea wordmark with pea pod logo" width="420">
  </picture>
</p>

# Em See Pea

Em See Pea is a general-purpose framework for Model Context Protocol (MCP)
`2026-07-28` servers over Streamable HTTP.

The project is pre-alpha. It supports a small set of tested MCP server features.
It does not support the full MCP server protocol yet.

Version 0.0.1 on npm is deprecated because it is missing the files needed to
run. Do not use it. Install a newer version from the `next` tag when available.

## What You Can Build Today

Use the current framework to create:

- a Fastify MCP server that runs on Node.js 22 or 24
- public tools that anyone can call
- tools that require a sign-in token before their code runs
- tools that call another service and check its response
- resources, reusable resource addresses, prompts, and field suggestions
- a local server that reports live progress while work is running
- two local server processes that share one SQLite report store
- a server with a native HTML form, or the same form rendered with React and
  the Em See Pea stylesheet

The live-progress feature passed its
[Node.js 22 and 24 test run][streaming-quality]. It is not ready for production
servers or proxies yet.

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
[0.0.2 release-readiness review][release-readiness].

## Run an Example

Build the workspaces first:

```sh
npm run build
```

Then choose what you want to build:

- Start with one small public tool: `npm run start:basic`
- Connect a tool to a public web service: `npm run start:backend`
- Require sign-in for a tool while keeping discovery public: `npm run start:protected`
- Give an assistant reference content and reusable prompts: `npm run start:resources-prompts`
- Report progress while a slow tool runs: `npm run start:streaming`
- Avoid creating the same local report twice across two server processes: `npm run start:multi-instance`
- Add a server-rendered form without a UI framework: `npm run start:native-ui`
- Add the same form to a React application: `npm run start:react-ui`

The sign-in example uses the made-up token `example-access-token`. It shows
where token checking fits. It is not a production sign-in system.

## Check Whether a Language Model Understands the Results

```sh
npm run claude:prepare
npm run claude:login
npm run test:eval
```

This Promptfoo check asks a language model questions about every running
example. It catches answers that look plausible but misunderstand the data.
Returning valid JSON is not enough.

Skip `npm run claude:login` when Claude is already signed in on your computer.

## Run the Provisional Performance Check

```sh
npm run benchmark
```

This measures the current JSON handling. It does not measure connected
services, tools that require sign-in, resources, prompts, suggestions, or live
progress.

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
- changing catalogues while a server runs or configuring how clients cache them
- production streaming through proxy servers
- saved sessions, subscriptions, replay, or reconnect recovery
- shared operation across computers or a promise that retries change an
  external service only once
- full coverage of the active MCP server protocol

Publication does not expand these claims.

## Project Documents

- [Getting started from source](docs/guides/getting-started.md)
- [Battle plan](BATTLE-PLAN.md)
- [Quality policy][quality-policy]
- [Release-readiness review][release-readiness]
- [Risk register](docs/risks/README.md)
- [Server package decision](docs/decisions/0016-em-see-pea-product-npm-scope-and-server-package.proposed.md)
- [Public discovery and sign-in checks][public-discovery]
- [Language-model understanding checks][semantic-qualification]
- [Cognitive-accessibility publication rule][cognitive-publication]
- [Brand style guide](docs/brand/STYLE-GUIDE.md)

The source and examples are public under MIT. The root and examples remain
private npm workspaces. Only `@emseepea/server` and `@emseepea/testing` are
eligible for publication.

[cognitive-publication]: docs/decisions/0023-mandatory-cognitive-accessibility-review-for-published-content.proposed.md
[public-discovery]: docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.proposed.md
[quality-policy]: QUALITY.md
[release-readiness]: docs/reviews/0.0.2-release-readiness.md
[semantic-qualification]: docs/decisions/0024-subscription-backed-claude-semantic-release-checks.proposed.md
[streaming-quality]: https://github.com/windyroad/emseepea/actions/runs/33070295308
