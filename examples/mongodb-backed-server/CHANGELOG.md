# @emseepea/create-mongodb-backed-server

## 0.0.10

### Patch Changes

- [`89f450d`](https://github.com/emseepea/emseepea/commit/89f450dfb1daf662dcd1ae4c4ec0bf7619dfe24b) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional checked client roots through MCP input-required rounds. Direct
  tools, resources, resource templates, and prompts can request workspace roots.
  Validate roots before handlers run and preserve authorization on every round.

## 0.0.9

### Patch Changes

- [#69](https://github.com/emseepea/emseepea/pull/69) [`7454904`](https://github.com/emseepea/emseepea/commit/7454904f4561a966ac72063f4a9ce2eda2c37578) Thanks [@tompahoward](https://github.com/tompahoward)! - Add safe production container builds to every standalone initializer, backed by
  a fail-closed deployment-file loader and centralized npm commands.

## 0.0.8

### Patch Changes

- [`3c5c0f4`](https://github.com/emseepea/emseepea/commit/3c5c0f47aaeefc04476a666dbb57a9cad72d2ee3) Thanks [@tompahoward](https://github.com/tompahoward)! - Update every initializer to generate projects with `@emseepea/server` 0.9.0 and its request-scoped client logging API.

## 0.0.7

### Patch Changes

- [`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693) Thanks [@tompahoward](https://github.com/tompahoward)! - Support five named legacy Model Context Protocol (MCP) revisions through the existing stateless POST endpoint while retaining MCP 2026-07-28 as the active protocol target.
  Refresh every maintained initializer so newly generated projects install this server release.

## 0.0.6

### Patch Changes

- [`79efc97`](https://github.com/emseepea/emseepea/commit/79efc975b2e7ec820b4fc3f3529c9bb0144fd75a) Thanks [@tompahoward](https://github.com/tompahoward)! - Regenerate every maintained initializer so new projects install
  @emseepea/server 0.7.0, @emseepea/feedback 0.2.1, and @emseepea/testing 0.9.4.

## 0.0.5

### Patch Changes

- [`da97d77`](https://github.com/emseepea/emseepea/commit/da97d777f4bfe7081c04ccf593568733d010a7b0) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep the user's original request primary after feedback is submitted. The
  feedback result now reminds the AI to finish that request and disclose the
  specific observation, while routine successful tool use is explicitly excluded
  from feedback.

## 0.0.4

### Patch Changes

- [`8925636`](https://github.com/emseepea/emseepea/commit/8925636bd8ca24cab7c22c73ec89d9de3e5ed17f) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow successful semantic checks to accept one optional positive feedback call
  after their exact primary tool calls. Also prove that the feedback call
  succeeded and was openly described.

## 0.0.3

### Patch Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.

  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

## 0.0.2

### Patch Changes

- [`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add typed authentication, permission-shaped discovery, and framework-redacted
  observability adapters. Every initializer now demonstrates open and protected
  composition from the same app factory. Retire the redundant sign-in initializer.

## 0.0.1

### Patch Changes

- [`3e655bb`](https://github.com/emseepea/emseepea/commit/3e655bb9095e67a4b40381b35cc12122a706d885) Thanks [@tompahoward](https://github.com/tompahoward)! - Add initializer packages for schema-generated PostgreSQL integration, MongoDB
  collections with and without database validation, and contract-validated SOAP
  services.

  Isolate stateful semantic-test server environments per answer trial and expose
  captured server output for credential-safe integration assertions.

## 0.0.1

- Demonstrate schema-enforced and schemaless MongoDB collections together.
- Validate schemaless observations before writes and after reads.

## 0.0.0

Initial development version.
