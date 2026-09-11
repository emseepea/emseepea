# @emseepea/testing

## 0.9.6

### Patch Changes

- Updated dependencies [[`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693)]:
  - @emseepea/server@0.8.1

## 0.9.5

### Patch Changes

- Updated dependencies [[`c77d852`](https://github.com/emseepea/emseepea/commit/c77d852e729f3d809f87f8d0f4dd83774be915b0)]:
  - @emseepea/server@0.8.0

## 0.9.4

### Patch Changes

- Updated dependencies [[`b656c8e`](https://github.com/emseepea/emseepea/commit/b656c8e86fa39a7b3dae53702eba36a582831cc7)]:
  - @emseepea/server@0.7.0

## 0.9.3

### Patch Changes

- [`da97d77`](https://github.com/emseepea/emseepea/commit/da97d777f4bfe7081c04ccf593568733d010a7b0) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep the user's original request primary after feedback is submitted. The
  feedback result now reminds the AI to finish that request and disclose the
  specific observation, while routine successful tool use is explicitly excluded
  from feedback.

## 0.9.2

### Patch Changes

- Updated dependencies [[`3dd98aa`](https://github.com/emseepea/emseepea/commit/3dd98aaa73b0b7e1385e8abd758657a6f5e11f4c)]:
  - @emseepea/server@0.6.1

## 0.9.1

### Patch Changes

- Updated dependencies [[`69d5dad`](https://github.com/emseepea/emseepea/commit/69d5dada9cafc9b11e3f16dbd4c1bef6b9adba9f)]:
  - @emseepea/server@0.6.0

## 0.9.0

### Minor Changes

- [`8925636`](https://github.com/emseepea/emseepea/commit/8925636bd8ca24cab7c22c73ec89d9de3e5ed17f) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow successful semantic checks to accept one optional positive feedback call
  after their exact primary tool calls. Also prove that the feedback call
  succeeded and was openly described.

## 0.8.0

### Minor Changes

- [`1518f94`](https://github.com/emseepea/emseepea/commit/1518f9409d76b0306fd745190323798d7ade2af2) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow deliberately unsuccessful semantic journeys to accept either no tool
  call or one named feedback call, while still rejecting unrelated or duplicate
  calls. Keep successful starter journeys strict about negative feedback.

## 0.7.0

### Minor Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.

  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

### Patch Changes

- Updated dependencies [[`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add)]:
  - @emseepea/server@0.5.0

## 0.6.1

### Patch Changes

- [`9cde41d`](https://github.com/emseepea/emseepea/commit/9cde41d1fb5586ab98706b9c65c2dfc51cffd13f) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep permission-hidden empty catalogues out of native model evaluation clients.

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
