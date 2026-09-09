# @emseepea/testing

## 0.6.0

### Minor Changes

- [`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add typed authentication, permission-shaped discovery, and framework-redacted
  observability adapters. Every initializer now demonstrates open and protected
  composition from the same app factory. Retire the redundant sign-in initializer.

### Patch Changes

- Updated dependencies [[`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a)]:
  - @emseepea/server@0.4.0

## 0.5.3

### Patch Changes

- [`3e655bb`](https://github.com/emseepea/emseepea/commit/3e655bb9095e67a4b40381b35cc12122a706d885) Thanks [@tompahoward](https://github.com/tompahoward)! - Add initializer packages for schema-generated PostgreSQL integration, MongoDB
  collections with and without database validation, and contract-validated SOAP
  services.
  
  Isolate stateful semantic-test server environments per answer trial and expose
  captured server output for credential-safe integration assertions.

## 0.5.2

### Patch Changes

- [`b4104e8`](https://github.com/emseepea/emseepea/commit/b4104e80ca75bd851641a146695c501f0f9865bd) Thanks [@tompahoward](https://github.com/tompahoward)! - Identify the failed answer trial and retain its safe provider failure category.

## 0.5.1

### Patch Changes

- [`eca6a29`](https://github.com/emseepea/emseepea/commit/eca6a29bb2c4b33ab8276c0ccdf64407ca1273b5) Thanks [@tompahoward](https://github.com/tompahoward)! - Record a useful, credential-safe cause when a semantic judge invocation fails.

## 0.5.0

### Minor Changes

- [`0df0141`](https://github.com/emseepea/emseepea/commit/0df01416f3b16cf8d3aa7ce43f3cf1bc515ccaf8) Thanks [@tompahoward](https://github.com/tompahoward)! - Make semantic test failures directly diagnosable from their saved evidence.
  Reports now retain synthetic test conversations, advertised MCP tool exchanges,
  expectations, and every judge reason while continuing to exclude provider and
  harness credentials, provider events, transport configuration, environment
  values, and stderr. Secrets inside test content are not detected or redacted.

## 0.4.0

### Minor Changes

- [`6a0058f`](https://github.com/emseepea/emseepea/commit/6a0058f85746a4ee4cc5e7783da6b82cba2ea326) Thanks [@tompahoward](https://github.com/tompahoward)! - Run semantic conversations through the provider's native MCP client. User
  messages now reach the model unchanged, tool assertions come from native tool
  events, and the removed `prepare()` API can no longer inject harness-created
  context. The testing API and guide explain the evidence boundary.

## 0.3.0

### Minor Changes

- [`aa69cba`](https://github.com/emseepea/emseepea/commit/aa69cbaacbeaa9f7cf92b1f2b4d9bbb63b68f8df) Thanks [@tompahoward](https://github.com/tompahoward)! - Replace configuration-object semantic tests with readable, multi-turn
  conversation tests. Assert exact tool calls, literal response content, and
  model-judged response meaning with focused helpers built on Node assertions and
  the existing isolated Em See Pea judge.

## 0.2.2

### Patch Changes

- [`8ed59f9`](https://github.com/emseepea/emseepea/commit/8ed59f945e62544a034b8a88b88f8ceed08cb234) Thanks [@tompahoward](https://github.com/tompahoward)! - Rename each example directory to match its initializer command and package name,
  use one garden pea theme throughout, and publish every public package on npm's
  default `latest` channel. Update links, documentation, tests, scripts, and
  generated projects to match.

## 0.2.1

### Patch Changes

- [#22](https://github.com/emseepea/emseepea/pull/22) [`247a375`](https://github.com/emseepea/emseepea/commit/247a375696519f69979442857efcf23e775bef75) Thanks [@tompahoward](https://github.com/tompahoward)! - Point package source, documentation, and issue links at the Em See Pea GitHub organisation.

## 0.2.0

### Minor Changes

- [#19](https://github.com/windyroad/emseepea/pull/19) [`f614fb6`](https://github.com/windyroad/emseepea/commit/f614fb6304b670a2b792c71169fabba1a982ace1) Thanks [@tompahoward](https://github.com/tompahoward)! - Add `toolSelectionTest` so semantic checks can verify that a model selects the
  expected advertised MCP tools before it interprets their results.

## 0.1.0

### Minor Changes

- [#13](https://github.com/windyroad/emseepea/pull/13) [`a53f874`](https://github.com/windyroad/emseepea/commit/a53f8748bf5c8e8751e54c061c61eab6b8d19d46) Thanks [@tompahoward](https://github.com/tompahoward)! - Write AI understanding tests in JavaScript instead of YAML. Tests can use setup
  hooks, several MCP calls, generated cases, and custom assertions.
  
  Move cases into an `eval/` directory and run `emseepea-test eval`. Ordinary
  tests stay in `test/`. The runner finds nested test files automatically.
  
  YAML cases are no longer supported. Use `semanticTest` from
  `@emseepea/testing/semantic` to migrate them. Each case still requires three
  fresh answers and nine independent judgments. Promptfoo is no longer a
  dependency.

## 0.0.2

### Patch Changes

- [`d2722a1`](https://github.com/windyroad/emseepea/commit/d2722a173174ddeb11b3d17e26bd7ce8843c8ce5) Thanks [@tompahoward](https://github.com/tompahoward)! - Fix both public packages so they include the files needed to run them. Version
  0.0.1 omitted those files and should not be used.

## 0.0.1

### Patch Changes

- [`99eacdb`](https://github.com/windyroad/emseepea/commit/99eacdb00d2af5c8ed3191501d300a2f3d0c45ac) Thanks [@tompahoward](https://github.com/tompahoward)! - Add the public testing package and example-owned quality checks. Examples now
  carry their own deterministic tests, lint command, and semantic eval file.
