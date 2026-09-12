# @emseepea/create-tool-server

## 0.0.28

### Patch Changes

- [`34bd2b3`](https://github.com/emseepea/emseepea/commit/34bd2b3ca147cd359bc22ac06aa8a78f9044d69c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked protocol-native MCP tool results while preserving existing structured convenience handlers.

## 0.0.27

### Patch Changes

- [`2c97dfb`](https://github.com/emseepea/emseepea/commit/2c97dfbb4cb0dd422675ea77fbe40ba35cbf2e54) Thanks [@tompahoward](https://github.com/tompahoward)! - Document and preserve the intentional rejection of deprecated MCP Sampling.

## 0.0.26

### Patch Changes

- [`4da6f31`](https://github.com/emseepea/emseepea/commit/4da6f31a9885c4613001545fcfefbd246a75fa6f) Thanks [@tompahoward](https://github.com/tompahoward)! - Generated starters now install `@emseepea/server@0.10.1` and matching Em See Pea package versions.

## 0.0.25

### Patch Changes

- [`89f450d`](https://github.com/emseepea/emseepea/commit/89f450dfb1daf662dcd1ae4c4ec0bf7619dfe24b) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional checked client roots through MCP input-required rounds. Direct
  tools, resources, resource templates, and prompts can request workspace roots.
  Validate roots before handlers run and preserve authorization on every round.

## 0.0.24

### Patch Changes

- [#69](https://github.com/emseepea/emseepea/pull/69) [`7454904`](https://github.com/emseepea/emseepea/commit/7454904f4561a966ac72063f4a9ce2eda2c37578) Thanks [@tompahoward](https://github.com/tompahoward)! - Add safe production container builds to every standalone initializer, backed by
  a fail-closed deployment-file loader and centralized npm commands.

## 0.0.23

### Patch Changes

- [`3c5c0f4`](https://github.com/emseepea/emseepea/commit/3c5c0f47aaeefc04476a666dbb57a9cad72d2ee3) Thanks [@tompahoward](https://github.com/tompahoward)! - Update every initializer to generate projects with `@emseepea/server` 0.9.0 and its request-scoped client logging API.

## 0.0.22

### Patch Changes

- [`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693) Thanks [@tompahoward](https://github.com/tompahoward)! - Support five named legacy Model Context Protocol (MCP) revisions through the existing stateless POST endpoint while retaining MCP 2026-07-28 as the active protocol target.
  Refresh every maintained initializer so newly generated projects install this server release.

## 0.0.21

### Patch Changes

- [`79efc97`](https://github.com/emseepea/emseepea/commit/79efc975b2e7ec820b4fc3f3529c9bb0144fd75a) Thanks [@tompahoward](https://github.com/tompahoward)! - Regenerate every maintained initializer so new projects install
  @emseepea/server 0.7.0, @emseepea/feedback 0.2.1, and @emseepea/testing 0.9.4.

## 0.0.20

### Patch Changes

- [`da97d77`](https://github.com/emseepea/emseepea/commit/da97d777f4bfe7081c04ccf593568733d010a7b0) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep the user's original request primary after feedback is submitted. The
  feedback result now reminds the AI to finish that request and disclose the
  specific observation, while routine successful tool use is explicitly excluded
  from feedback.

## 0.0.19

### Patch Changes

- [`8925636`](https://github.com/emseepea/emseepea/commit/8925636bd8ca24cab7c22c73ec89d9de3e5ed17f) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow successful semantic checks to accept one optional positive feedback call
  after their exact primary tool calls. Also prove that the feedback call
  succeeded and was openly described.

## 0.0.18

### Patch Changes

- [`1518f94`](https://github.com/emseepea/emseepea/commit/1518f9409d76b0306fd745190323798d7ade2af2) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow deliberately unsuccessful semantic journeys to accept either no tool
  call or one named feedback call, while still rejecting unrelated or duplicate
  calls. Keep successful starter journeys strict about negative feedback.

## 0.0.17

### Patch Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.

  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

## 0.0.16

### Patch Changes

- [`9cde41d`](https://github.com/emseepea/emseepea/commit/9cde41d1fb5586ab98706b9c65c2dfc51cffd13f) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep permission-hidden empty catalogues out of native model evaluation clients.

## 0.0.15

### Patch Changes

- [`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add typed authentication, permission-shaped discovery, and framework-redacted
  observability adapters. Every initializer now demonstrates open and protected
  composition from the same app factory. Retire the redundant sign-in initializer.

## 0.0.14

### Patch Changes

- [`0649825`](https://github.com/emseepea/emseepea/commit/064982503d6b86efbef42d1253bb944737163357) Thanks [@tompahoward](https://github.com/tompahoward)! - Publish the updated maintained initializers so generated projects use @emseepea/testing 0.5.3 and link to the expanded template comparison.

## 0.0.13

### Patch Changes

- [`b4104e8`](https://github.com/emseepea/emseepea/commit/b4104e80ca75bd851641a146695c501f0f9865bd) Thanks [@tompahoward](https://github.com/tompahoward)! - Identify the failed answer trial and retain its safe provider failure category.

## 0.0.12

### Patch Changes

- [`6f2ca9e`](https://github.com/emseepea/emseepea/commit/6f2ca9e60d7aca21965ed2f24ce9f85e582fe478) Thanks [@tompahoward](https://github.com/tompahoward)! - Generate projects with the latest inspectable semantic test diagnostics. Publish
  the PostgreSQL multi-instance initializer.

## 0.0.11

### Patch Changes

- [`6a0058f`](https://github.com/emseepea/emseepea/commit/6a0058f85746a4ee4cc5e7783da6b82cba2ea326) Thanks [@tompahoward](https://github.com/tompahoward)! - Run semantic conversations through the provider's native MCP client. User
  messages now reach the model unchanged, tool assertions come from native tool
  events, and the removed `prepare()` API can no longer inject harness-created
  context. The testing API and guide explain the evidence boundary.

## 0.0.10

### Patch Changes

- [`6c6d544`](https://github.com/emseepea/emseepea/commit/6c6d544ed45b8b4bb7b1f83a8f4e9efcea171f9a) Thanks [@tompahoward](https://github.com/tompahoward)! - Make validated structured tool data the default result. Tool handlers can omit
  custom text, and Em See Pea will return the same data as `structuredContent`
  and serialized JSON text for compatibility. The maintained tool examples now
  demonstrate this smaller pattern.

## 0.0.9

### Patch Changes

- [`cec4ca3`](https://github.com/emseepea/emseepea/commit/cec4ca372b27978041668223ed76a368dd012d56) Thanks [@tompahoward](https://github.com/tompahoward)! - Describe every public example input and output property in the MCP schemas sent to clients.

## 0.0.8

### Patch Changes

- [`7053c47`](https://github.com/emseepea/emseepea/commit/7053c4719a6ec55ce8d09c3381e040c503118749) Thanks [@tompahoward](https://github.com/tompahoward)! - Remove repeated schema declarations and use matching schema variable names in maintained starter code and framework guidance.

## 0.0.7

### Patch Changes

- [`37f35ef`](https://github.com/emseepea/emseepea/commit/37f35ef84484edbd1fe5d07a192f49fb7379ee3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add clearer semantic tests for each starter, including short follow-up prompts, while limiting the number of AI-judged assertions.

## 0.0.6

### Patch Changes

- [`aa69cba`](https://github.com/emseepea/emseepea/commit/aa69cbaacbeaa9f7cf92b1f2b4d9bbb63b68f8df) Thanks [@tompahoward](https://github.com/tompahoward)! - Replace configuration-object semantic tests with readable, multi-turn
  conversation tests. Assert exact tool calls, literal response content, and
  model-judged response meaning with focused helpers built on Node assertions and
  the existing isolated Em See Pea judge.

## 0.0.5

### Patch Changes

- [`e1b4aba`](https://github.com/emseepea/emseepea/commit/e1b4aba3d829c931c892a79915d0c5eb7a54789a) Thanks [@tompahoward](https://github.com/tompahoward)! - Generate projects with the released Em See Pea server version.

## 0.0.4

### Patch Changes

- [`8ed59f9`](https://github.com/emseepea/emseepea/commit/8ed59f945e62544a034b8a88b88f8ceed08cb234) Thanks [@tompahoward](https://github.com/tompahoward)! - Rename each example directory to match its initializer command and package name,
  use one garden pea theme throughout, and publish every public package on npm's
  default `latest` channel. Update links, documentation, tests, scripts, and
  generated projects to match.

## 0.0.3

### Patch Changes

- [`1888482`](https://github.com/emseepea/emseepea/commit/188848205e0f488e7cd5700dd7a15b28a915ae43) Thanks [@tompahoward](https://github.com/tompahoward)! - Document schema-declared pass-through mapping and update the API-backed starter
  to preserve new valid provider values without a release. Colocate every public
  initializer package with its maintained example source.

## 0.0.2

### Patch Changes

- [`cff3470`](https://github.com/emseepea/emseepea/commit/cff347076c81ebdc74c5b6ee5d436dbd99134e77) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in deterministic startup discovery for capability modules, reject undeclared mapped output properties at compile time, and update the starters to use discovery.

## 0.0.1

### Patch Changes

- [`dae6e45`](https://github.com/emseepea/emseepea/commit/dae6e4589e6c079c730d099b7bd104fc68b4005f) Thanks [@tompahoward](https://github.com/tompahoward)! - Add standalone npm initializers for all eight maintained server examples.
