# @emseepea/create-multi-instance-postgres-server

## 0.0.31

### Patch Changes

- [`ed936ec`](https://github.com/emseepea/emseepea/commit/ed936ec494c9c5e5f70f9ee7677b886dcc2354f7) Thanks [@tompahoward](https://github.com/tompahoward)! - Start new projects on the release that publishes result schemas open

  Each starter pins a version of the server package. Projects you create from it
  use that version. That pin now points at the release that publishes result
  schemas open. A project you start from one of these starters begins with result
  schemas that a client can tolerate a new field in.

  Two starters, `@emseepea/create-html-ui-server` and
  `@emseepea/create-react-ui-server`, also carry a copy of the shared example
  result schema. That copy is open now too, so the schema you would copy from
  publishes an open contract rather than a closed one.

  You do not need to do anything. This only affects projects created after this
  release.

## 0.0.30

### Patch Changes

- [#116](https://github.com/emseepea/emseepea/pull/116) [`0b6b5ae`](https://github.com/emseepea/emseepea/commit/0b6b5ae5e58d39ff2fe2edc14b01571677f382b6) Thanks [@tompahoward](https://github.com/tompahoward)! - ## What changed

  Tool result schemas are now published open by default. An open schema allows
  fields it does not list. A closed schema rejects them.

  A tool result declared with `z.object` (Zod, the default schema library) now
  publishes a schema that permits unknown fields. You can add a result field later
  without breaking a client that validates against an older copy of that schema.

  ## Migration: re-capture your baselines once

  This release needs one action from you. Upgrading alone is not enough.

  After upgrading, the contract checker compares your new schemas against your
  baselines and flags a break. Your baselines are the stored copies of the schemas
  you published last time.

  The break is named `output-additional-properties-changed`. It is reported once for
  every object in an affected result schema, so a schema with nested objects reports
  several breaks.

  If your result schema uses `$defs` — the JSON Schema keyword for reusable
  sub-schemas — the checker reports a second break at the same location, because it
  cannot categorise a change inside a `$defs` entry. That break is named
  `unclassified-schema-change`.

  Both breaks are expected here. Re-capture your baselines once after upgrading, with
  `emseepea-contract capture`. Both breaks then stop being reported. Reporting them
  once is how the change stays visible rather than silent.

  ## How to keep a result schema closed

  A declaration stays closed only if it closes both directions:

  - input — what the caller may send
  - output — what the tool returns

  These stay closed. Nothing changes for them:

  1. `z.strictObject`.
  2. A hand-written JSON Schema that closes both directions.

  One case now opens: a declaration that closes output only.

  That case has one exception. To open the output, the framework pairs each object in
  the input shape with an object in the output shape. If the two shapes differ too
  much to pair, the schema stays closed.

  ## What did not change

  Result values. A handler can still return only the keys its result schema declares,
  and a response still carries only declared fields. The published schema states what
  a client must tolerate; it does not widen what the server sends.

  ## For maintainers publishing this release

  Publish every affected `create-*` package in the same release as the
  `@emseepea/server` version it pins, so the whole set can be verified together.

## 0.0.29

### Patch Changes

- [`6af8aca`](https://github.com/emseepea/emseepea/commit/6af8aca9c33f54753c31c31c6170f0c3afb82383) Thanks [@tompahoward](https://github.com/tompahoward)! - Add an opt-in `check` policy module to `emseepea-contract` for application-owned legacy baseline migration, normalization, and comparison. The CLI keeps discovery, extraction, redaction, diagnostics, and exit codes, while existing checks without a policy keep their current behavior.

  Release every affected public initializer package together with the generated `@emseepea/testing` package it uses for development. This ensures that all affected packages are included in the release and can be verified.

## 0.0.28

### Patch Changes

- [`3d27143`](https://github.com/emseepea/emseepea/commit/3d27143d184ede761763bcd267fe650df9bad013) Thanks [@tompahoward](https://github.com/tompahoward)! - Release each public initializer with its generated `@emseepea/testing@0.15.0` development dependency so every affected package is included in the release and can be verified.

## 0.0.27

### Patch Changes

- [`9eed174`](https://github.com/emseepea/emseepea/commit/9eed174d916de6280eae9f5f52467fb7d6a18769) Thanks [@tompahoward](https://github.com/tompahoward)! - Update initializer manifests to use `@emseepea/server@0.14.0`.

## 0.0.26

### Patch Changes

- [`95c2f05`](https://github.com/emseepea/emseepea/commit/95c2f054af1b38560f65489641d9c92782df0430) Thanks [@tompahoward](https://github.com/tompahoward)! - Update the initializer's development dependency on `@emseepea/testing` to
  `0.14.0`. This changes repository checks only; generated applications do not
  gain a runtime dependency, and the update does not prove public-host
  compatibility.

## 0.0.25

### Patch Changes

- [`12f06ce`](https://github.com/emseepea/emseepea/commit/12f06ce22fc320e9008ff67434eb72119c84c72b) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow `defineMcpAppResource` callers to preserve an established
  `text/html+skybridge` contract. The existing `text/html;profile=mcp-app`
  default remains unchanged, and the selected value is used for both resource
  listing and returned content.

## 0.0.24

### Patch Changes

- [`9214959`](https://github.com/emseepea/emseepea/commit/9214959269de548f39c9de4d35aa2212ab3ec17a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add reusable WCAG contrast-ratio and assertion helpers so applications can test
  their own opaque sRGB color pairs without reimplementing the WCAG luminance and
  contrast calculations. This release also aligns the embedded
  `@emseepea/testing` dependency in all 11 initializers.

## 0.0.23

### Patch Changes

- [`6d47e72`](https://github.com/emseepea/emseepea/commit/6d47e72ce797e12b2348268a63f00d8753d2980d) Thanks [@tompahoward](https://github.com/tompahoward)! - Add deterministic published MCP contract baselines and direction-aware compatibility checks for tools, schemas, resources, UI metadata, MIME types, and Content Security Policy. Keep the initializers' embedded testing dependency aligned with this release.

## 0.0.22

### Patch Changes

- [`4d2c4c5`](https://github.com/emseepea/emseepea/commit/4d2c4c5e2df1c7bf626f704b6fe2a0d7cfd92174) Thanks [@tompahoward](https://github.com/tompahoward)! - Add `defineMcpAppResource` to package a Model Context Protocol (MCP) App HTML
  resource with matching MCP Apps `ui` metadata and ChatGPT Apps compatibility
  aliases. The helper validates the URI, script, language, and content security
  policy (CSP) when the resource is defined. Update the React UI starter to use
  the helper; keep the other starters' embedded server dependency aligned with
  this release.

## 0.0.21

### Patch Changes

- [`2e1258e`](https://github.com/emseepea/emseepea/commit/2e1258ea3eb04bd2b7cbf048e8056654f065a797) Thanks [@tompahoward](https://github.com/tompahoward)! - Release the initializer packages with manifests that use
  `@emseepea/server@0.12.0`.

## 0.0.20

### Patch Changes

- [`df98a2a`](https://github.com/emseepea/emseepea/commit/df98a2a1d63ecf57a48f45fe528af757fd05a635) Thanks [@tompahoward](https://github.com/tompahoward)! - Release the initializer packages with manifests that use
  `@emseepea/server@0.11.2`.

## 0.0.19

### Patch Changes

- [`aba65fa`](https://github.com/emseepea/emseepea/commit/aba65faf63b00b62ab4503fdeecc42120be88667) Thanks [@tompahoward](https://github.com/tompahoward)! - Release the initializer packages with manifests that use `@emseepea/server@0.11.1`.

## 0.0.18

### Patch Changes

- [`681095e`](https://github.com/emseepea/emseepea/commit/681095ee11d5bb4343d7b0c1230c63242abaefac) Thanks [@tompahoward](https://github.com/tompahoward)! - Release initializer manifests with the updated MCP Apps host simulator testing dependency.

## 0.0.17

### Patch Changes

- [`cb69374`](https://github.com/emseepea/emseepea/commit/cb693744387d52d31c463c939094282efb216c6c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add a validated, accessible tool-result view model and native renderer, React
  and Svelte `ResultCard` components, and standards-first MCP Apps lifecycle
  bindings. Update the React UI server example to use the public result APIs.

## 0.0.16

### Patch Changes

- [`34bd2b3`](https://github.com/emseepea/emseepea/commit/34bd2b3ca147cd359bc22ac06aa8a78f9044d69c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked protocol-native MCP tool results while preserving existing structured convenience handlers.

## 0.0.15

### Patch Changes

- [`2c97dfb`](https://github.com/emseepea/emseepea/commit/2c97dfbb4cb0dd422675ea77fbe40ba35cbf2e54) Thanks [@tompahoward](https://github.com/tompahoward)! - Document and preserve the intentional rejection of deprecated MCP Sampling.

## 0.0.14

### Patch Changes

- [`4da6f31`](https://github.com/emseepea/emseepea/commit/4da6f31a9885c4613001545fcfefbd246a75fa6f) Thanks [@tompahoward](https://github.com/tompahoward)! - Generated starters now install `@emseepea/server@0.10.1` and matching Em See Pea package versions.

## 0.0.13

### Patch Changes

- [`89f450d`](https://github.com/emseepea/emseepea/commit/89f450dfb1daf662dcd1ae4c4ec0bf7619dfe24b) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional checked client roots through MCP input-required rounds. Direct
  tools, resources, resource templates, and prompts can request workspace roots.
  Validate roots before handlers run and preserve authorization on every round.

## 0.0.12

### Patch Changes

- [#69](https://github.com/emseepea/emseepea/pull/69) [`7454904`](https://github.com/emseepea/emseepea/commit/7454904f4561a966ac72063f4a9ce2eda2c37578) Thanks [@tompahoward](https://github.com/tompahoward)! - Add safe production container builds to every standalone initializer, backed by
  a fail-closed deployment-file loader and centralized npm commands.

## 0.0.11

### Patch Changes

- [`3c5c0f4`](https://github.com/emseepea/emseepea/commit/3c5c0f47aaeefc04476a666dbb57a9cad72d2ee3) Thanks [@tompahoward](https://github.com/tompahoward)! - Update every initializer to generate projects with `@emseepea/server` 0.9.0 and its request-scoped client logging API.

## 0.0.10

### Patch Changes

- [`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693) Thanks [@tompahoward](https://github.com/tompahoward)! - Support five named legacy Model Context Protocol (MCP) revisions through the existing stateless POST endpoint while retaining MCP 2026-07-28 as the active protocol target.
  Refresh every maintained initializer so newly generated projects install this server release.

## 0.0.9

### Patch Changes

- [`79efc97`](https://github.com/emseepea/emseepea/commit/79efc975b2e7ec820b4fc3f3529c9bb0144fd75a) Thanks [@tompahoward](https://github.com/tompahoward)! - Regenerate every maintained initializer so new projects install
  @emseepea/server 0.7.0, @emseepea/feedback 0.2.1, and @emseepea/testing 0.9.4.

## 0.0.8

### Patch Changes

- [`da97d77`](https://github.com/emseepea/emseepea/commit/da97d777f4bfe7081c04ccf593568733d010a7b0) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep the user's original request primary after feedback is submitted. The
  feedback result now reminds the AI to finish that request and disclose the
  specific observation, while routine successful tool use is explicitly excluded
  from feedback.

## 0.0.7

### Patch Changes

- [`8925636`](https://github.com/emseepea/emseepea/commit/8925636bd8ca24cab7c22c73ec89d9de3e5ed17f) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow successful semantic checks to accept one optional positive feedback call
  after their exact primary tool calls. Also prove that the feedback call
  succeeded and was openly described.

## 0.0.6

### Patch Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.

  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

## 0.0.5

### Patch Changes

- [`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add typed authentication, permission-shaped discovery, and framework-redacted
  observability adapters. Every initializer now demonstrates open and protected
  composition from the same app factory. Retire the redundant sign-in initializer.

## 0.0.4

### Patch Changes

- [`0649825`](https://github.com/emseepea/emseepea/commit/064982503d6b86efbef42d1253bb944737163357) Thanks [@tompahoward](https://github.com/tompahoward)! - Publish the updated maintained initializers so generated projects use @emseepea/testing 0.5.3 and link to the expanded template comparison.

## 0.0.3

### Patch Changes

- [`9a31473`](https://github.com/emseepea/emseepea/commit/9a31473257d46301a2c2445b26d4de3ee5af0882) Thanks [@tompahoward](https://github.com/tompahoward)! - Replace public server identity and generic idempotency fields with instance-agnostic save and get tools keyed by garden bed and harvest date.

## 0.0.2

### Patch Changes

- [`b4104e8`](https://github.com/emseepea/emseepea/commit/b4104e80ca75bd851641a146695c501f0f9865bd) Thanks [@tompahoward](https://github.com/tompahoward)! - Identify the failed answer trial and retain its safe provider failure category.

## 0.0.1

### Patch Changes

- [`6f2ca9e`](https://github.com/emseepea/emseepea/commit/6f2ca9e60d7aca21965ed2f24ce9f85e582fe478) Thanks [@tompahoward](https://github.com/tompahoward)! - Generate projects with the latest inspectable semantic test diagnostics. Publish
  the PostgreSQL multi-instance initializer.
