# @emseepea/create-openapi-backed-server

## 0.0.19

### Patch Changes

- [`9eed174`](https://github.com/emseepea/emseepea/commit/9eed174d916de6280eae9f5f52467fb7d6a18769) Thanks [@tompahoward](https://github.com/tompahoward)! - Update initializer manifests to use `@emseepea/server@0.14.0`.

## 0.0.18

### Patch Changes

- [`95c2f05`](https://github.com/emseepea/emseepea/commit/95c2f054af1b38560f65489641d9c92782df0430) Thanks [@tompahoward](https://github.com/tompahoward)! - Update the initializer's development dependency on `@emseepea/testing` to
  `0.14.0`. This changes repository checks only; generated applications do not
  gain a runtime dependency, and the update does not prove public-host
  compatibility.

## 0.0.17

### Patch Changes

- [`12f06ce`](https://github.com/emseepea/emseepea/commit/12f06ce22fc320e9008ff67434eb72119c84c72b) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow `defineMcpAppResource` callers to preserve an established
  `text/html+skybridge` contract. The existing `text/html;profile=mcp-app`
  default remains unchanged, and the selected value is used for both resource
  listing and returned content.

## 0.0.16

### Patch Changes

- [`9214959`](https://github.com/emseepea/emseepea/commit/9214959269de548f39c9de4d35aa2212ab3ec17a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add reusable WCAG contrast-ratio and assertion helpers so applications can test
  their own opaque sRGB color pairs without reimplementing the WCAG luminance and
  contrast calculations. This release also aligns the embedded
  `@emseepea/testing` dependency in all 11 initializers.

## 0.0.15

### Patch Changes

- [`6d47e72`](https://github.com/emseepea/emseepea/commit/6d47e72ce797e12b2348268a63f00d8753d2980d) Thanks [@tompahoward](https://github.com/tompahoward)! - Add deterministic published MCP contract baselines and direction-aware compatibility checks for tools, schemas, resources, UI metadata, MIME types, and Content Security Policy. Keep the initializers' embedded testing dependency aligned with this release.

## 0.0.14

### Patch Changes

- [`4d2c4c5`](https://github.com/emseepea/emseepea/commit/4d2c4c5e2df1c7bf626f704b6fe2a0d7cfd92174) Thanks [@tompahoward](https://github.com/tompahoward)! - Add `defineMcpAppResource` to package a Model Context Protocol (MCP) App HTML
  resource with matching MCP Apps `ui` metadata and ChatGPT Apps compatibility
  aliases. The helper validates the URI, script, language, and content security
  policy (CSP) when the resource is defined. Update the React UI starter to use
  the helper; keep the other starters' embedded server dependency aligned with
  this release.

## 0.0.13

### Patch Changes

- [`2e1258e`](https://github.com/emseepea/emseepea/commit/2e1258ea3eb04bd2b7cbf048e8056654f065a797) Thanks [@tompahoward](https://github.com/tompahoward)! - Release the initializer packages with manifests that use
  `@emseepea/server@0.12.0`.

## 0.0.12

### Patch Changes

- [`df98a2a`](https://github.com/emseepea/emseepea/commit/df98a2a1d63ecf57a48f45fe528af757fd05a635) Thanks [@tompahoward](https://github.com/tompahoward)! - Release the initializer packages with manifests that use
  `@emseepea/server@0.11.2`.

## 0.0.11

### Patch Changes

- [`aba65fa`](https://github.com/emseepea/emseepea/commit/aba65faf63b00b62ab4503fdeecc42120be88667) Thanks [@tompahoward](https://github.com/tompahoward)! - Release the initializer packages with manifests that use `@emseepea/server@0.11.1`.

## 0.0.10

### Patch Changes

- [`681095e`](https://github.com/emseepea/emseepea/commit/681095ee11d5bb4343d7b0c1230c63242abaefac) Thanks [@tompahoward](https://github.com/tompahoward)! - Release initializer manifests with the updated MCP Apps host simulator testing dependency.

## 0.0.9

### Patch Changes

- [`cb69374`](https://github.com/emseepea/emseepea/commit/cb693744387d52d31c463c939094282efb216c6c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add a validated, accessible tool-result view model and native renderer, React
  and Svelte `ResultCard` components, and standards-first MCP Apps lifecycle
  bindings. Update the React UI server example to use the public result APIs.

## 0.0.8

### Patch Changes

- [`34bd2b3`](https://github.com/emseepea/emseepea/commit/34bd2b3ca147cd359bc22ac06aa8a78f9044d69c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked protocol-native MCP tool results while preserving existing structured convenience handlers.

## 0.0.7

### Patch Changes

- [`2c97dfb`](https://github.com/emseepea/emseepea/commit/2c97dfbb4cb0dd422675ea77fbe40ba35cbf2e54) Thanks [@tompahoward](https://github.com/tompahoward)! - Document and preserve the intentional rejection of deprecated MCP Sampling.

## 0.0.6

### Patch Changes

- [`4da6f31`](https://github.com/emseepea/emseepea/commit/4da6f31a9885c4613001545fcfefbd246a75fa6f) Thanks [@tompahoward](https://github.com/tompahoward)! - Generated starters now install `@emseepea/server@0.10.1` and matching Em See Pea package versions.

## 0.0.5

### Patch Changes

- [`89f450d`](https://github.com/emseepea/emseepea/commit/89f450dfb1daf662dcd1ae4c4ec0bf7619dfe24b) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional checked client roots through MCP input-required rounds. Direct
  tools, resources, resource templates, and prompts can request workspace roots.
  Validate roots before handlers run and preserve authorization on every round.

## 0.0.4

### Patch Changes

- [#69](https://github.com/emseepea/emseepea/pull/69) [`7454904`](https://github.com/emseepea/emseepea/commit/7454904f4561a966ac72063f4a9ce2eda2c37578) Thanks [@tompahoward](https://github.com/tompahoward)! - Add safe production container builds to every standalone initializer, backed by
  a fail-closed deployment-file loader and centralized npm commands.

## 0.0.3

### Patch Changes

- [`3c5c0f4`](https://github.com/emseepea/emseepea/commit/3c5c0f47aaeefc04476a666dbb57a9cad72d2ee3) Thanks [@tompahoward](https://github.com/tompahoward)! - Update every initializer to generate projects with `@emseepea/server` 0.9.0 and its request-scoped client logging API.

## 0.0.2

### Patch Changes

- [`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693) Thanks [@tompahoward](https://github.com/tompahoward)! - Support five named legacy Model Context Protocol (MCP) revisions through the existing stateless POST endpoint while retaining MCP 2026-07-28 as the active protocol target.
  Refresh every maintained initializer so newly generated projects install this server release.

## 0.0.1

### Patch Changes

- [`683dada`](https://github.com/emseepea/emseepea/commit/683dada33cd77b3b9dc50a656435efed5141bf7f) Thanks [@tompahoward](https://github.com/tompahoward)! - Add a separate initializer that generates backend TypeScript declarations and
  Zod runtime validation from a local OpenAPI contract, including Swagger 2
  conversion and generation-drift checks.

## 0.0.0

Initial unreleased version.
