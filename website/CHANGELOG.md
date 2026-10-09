# @emseepea/website

## 0.0.10

### Patch Changes

- [`4fa588d`](https://github.com/emseepea/emseepea/commit/4fa588d19832a6388443787e87f27dd48016d56e) Thanks [@tompahoward](https://github.com/tompahoward)! - Complete annotation override validation by preserving defaults for explicitly
  undefined flags and rejecting null configuration. Verify composed lifecycle
  and hook effects through real MCP clients and fresh packed installs. Update
  generated projects to the new feedback version and deploy the guidance.

## 0.0.9

### Patch Changes

- [`968f41e`](https://github.com/emseepea/emseepea/commit/968f41ec83bda45bd6872a96c1ec8f82930078df) Thanks [@tompahoward](https://github.com/tompahoward)! - Add authenticated private resource inventory listing to protected resource
  templates. Callbacks receive the validated caller and bounded query position;
  opaque cursors expire fifteen minutes after the first page and remain local to
  the serving process. Reads recheck access. Document ownership, authorization,
  live pagination, and restart behavior.

  Refresh initializer dependency versions for the new server release.

## 0.0.8

### Patch Changes

- [#142](https://github.com/emseepea/emseepea/pull/142) [`632f71b`](https://github.com/emseepea/emseepea/commit/632f71b2c3d0d80fe0def2a0642f680c2d520c84) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add collection-aware feedback submission, protected operator retrieval, and
  owner-scoped `feedback.submitted` events. Customer-facing servers submit
  customer feedback only. Internal servers submit internal feedback and monitor
  or read their authorized collections while the support backend remains
  authoritative.

  Add independently authorized subscription refresh, owner-specific event
  catalogues, and targeted publication. Document account isolation, exact record
  retrieval, durable storage, and customer and internal configuration.

  Refresh generated starters to use the updated server and feedback packages.

## 0.0.7

### Patch Changes

- [`68ee96c`](https://github.com/emseepea/emseepea/commit/68ee96c9a6807c14e2c4c53f934fd36c070ac038) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional MCP Events for team replies in protected feedback conversations. Events carry reply IDs, not reply text, and require an exact-thread access check before delivery.

## 0.0.6

### Patch Changes

- [`eb23a65`](https://github.com/emseepea/emseepea/commit/eb23a65a2c1c18be209f712a6850e6c25534904e) Thanks [@tompahoward](https://github.com/tompahoward)! - Document the bounded live ChatGPT Work MCP Events smoke test and link to its synthetic test server.

## 0.0.5

### Patch Changes

- [`f71c60d`](https://github.com/emseepea/emseepea/commit/f71c60d1163ee356485c0ce861b1401f33cca0f9) Thanks [@tompahoward](https://github.com/tompahoward)! - Clarify how Em See Pea's webhook-only MCP Events support relates to the draft extension and ChatGPT's current integration.

## 0.0.4

### Patch Changes

- [`edb0983`](https://github.com/emseepea/emseepea/commit/edb0983b9b8acff31da75f3095cbe0bae10fca93) Thanks [@tompahoward](https://github.com/tompahoward)! - Add an adopter guide for opt-in MCP Events webhooks, including configuration,
  the durable store contract, security requirements, supported methods, and
  verification limits.

## 0.0.3

### Patch Changes

- [`4342a00`](https://github.com/emseepea/emseepea/commit/4342a005a2578f8f0141f58d827b1a5e4fe2382f) Thanks [@tompahoward](https://github.com/tompahoward)! - Update the MCP versioning guide for independent tool reviews, rescans, and safe replacement ordering.

## 0.0.2

### Patch Changes

- [`b35186b`](https://github.com/emseepea/emseepea/commit/b35186b8f0a28ed87f987784bb8d7b53f8ef3f24) Thanks [@tompahoward](https://github.com/tompahoward)! - Add an opt-in Markdown file destination for one-way feedback submissions and document local repository use.

## 0.0.1

### Patch Changes

- [#130](https://github.com/emseepea/emseepea/pull/130) [`6d218eb`](https://github.com/emseepea/emseepea/commit/6d218eb1bc830ac9ca63ca43f49474ceedca3c0f) Thanks [@tompahoward](https://github.com/tompahoward)! - Publish the beta maturity and verified MCP coverage claims on the website.
