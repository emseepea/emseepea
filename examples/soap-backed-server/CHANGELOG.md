# @emseepea/create-soap-backed-server

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

## 0.0.0

Initial development version.
