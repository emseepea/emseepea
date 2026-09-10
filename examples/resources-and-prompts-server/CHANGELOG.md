# @emseepea/create-resources-and-prompts-server

## 0.0.15

### Patch Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.
  
  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

## 0.0.14

### Patch Changes

- [`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add typed authentication, permission-shaped discovery, and framework-redacted
  observability adapters. Every initializer now demonstrates open and protected
  composition from the same app factory. Retire the redundant sign-in initializer.

## 0.0.13

### Patch Changes

- [`0649825`](https://github.com/emseepea/emseepea/commit/064982503d6b86efbef42d1253bb944737163357) Thanks [@tompahoward](https://github.com/tompahoward)! - Publish the updated maintained initializers so generated projects use @emseepea/testing 0.5.3 and link to the expanded template comparison.

## 0.0.12

### Patch Changes

- [`b4104e8`](https://github.com/emseepea/emseepea/commit/b4104e80ca75bd851641a146695c501f0f9865bd) Thanks [@tompahoward](https://github.com/tompahoward)! - Identify the failed answer trial and retain its safe provider failure category.

## 0.0.11

### Patch Changes

- [`6f2ca9e`](https://github.com/emseepea/emseepea/commit/6f2ca9e60d7aca21965ed2f24ce9f85e582fe478) Thanks [@tompahoward](https://github.com/tompahoward)! - Generate projects with the latest inspectable semantic test diagnostics. Publish
  the PostgreSQL multi-instance initializer.

## 0.0.10

### Patch Changes

- [`6a0058f`](https://github.com/emseepea/emseepea/commit/6a0058f85746a4ee4cc5e7783da6b82cba2ea326) Thanks [@tompahoward](https://github.com/tompahoward)! - Run semantic conversations through the provider's native MCP client. User
  messages now reach the model unchanged, tool assertions come from native tool
  events, and the removed `prepare()` API can no longer inject harness-created
  context. The testing API and guide explain the evidence boundary.

## 0.0.9

### Patch Changes

- [`6c6d544`](https://github.com/emseepea/emseepea/commit/6c6d544ed45b8b4bb7b1f83a8f4e9efcea171f9a) Thanks [@tompahoward](https://github.com/tompahoward)! - Make validated structured tool data the default result. Tool handlers can omit
  custom text, and Em See Pea will return the same data as `structuredContent`
  and serialized JSON text for compatibility. The maintained tool examples now
  demonstrate this smaller pattern.

## 0.0.8

### Patch Changes

- [`cec4ca3`](https://github.com/emseepea/emseepea/commit/cec4ca372b27978041668223ed76a368dd012d56) Thanks [@tompahoward](https://github.com/tompahoward)! - Describe every public example input and output property in the MCP schemas sent to clients.

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
