# @emseepea/server

## 0.2.1

### Patch Changes

- [`1888482`](https://github.com/emseepea/emseepea/commit/188848205e0f488e7cd5700dd7a15b28a915ae43) Thanks [@tompahoward](https://github.com/tompahoward)! - Document schema-declared pass-through mapping and update the API-backed starter
  to preserve new valid provider values without a release. Colocate every public
  initializer package with its maintained example source.

## 0.2.0

### Minor Changes

- [`9bba0da`](https://github.com/emseepea/emseepea/commit/9bba0da8aed032957730b8443847579524a3cdc4) Thanks [@tompahoward](https://github.com/tompahoward)! - Reject undeclared public output properties at compile time for regular and streaming tools, matching mapped tools.

## 0.1.0

### Minor Changes

- [`cff3470`](https://github.com/emseepea/emseepea/commit/cff347076c81ebdc74c5b6ee5d436dbd99134e77) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in deterministic startup discovery for capability modules, reject undeclared mapped output properties at compile time, and update the starters to use discovery.

## 0.0.4

### Patch Changes

- [#22](https://github.com/emseepea/emseepea/pull/22) [`247a375`](https://github.com/emseepea/emseepea/commit/247a375696519f69979442857efcf23e775bef75) Thanks [@tompahoward](https://github.com/tompahoward)! - Point package source, documentation, and issue links at the Em See Pea GitHub organisation.

## 0.0.3

### Patch Changes

- [#4](https://github.com/windyroad/emseepea/pull/4) [`6e46d6d`](https://github.com/windyroad/emseepea/commit/6e46d6dd538c9916773a86b61e27231f33b9d17e) Thanks [@tompahoward](https://github.com/tompahoward)! - Let application authors create direct tools, resources, resource address
  patterns, and prompts that ask capable clients for form input or URL-mode
  elicitation before returning a final result. Every round keeps the existing
  sign-in, size, time, cancellation, and safe-error checks. Opaque request state
  is rejected.

- [`f8bdda6`](https://github.com/windyroad/emseepea/commit/f8bdda6642b4102a80807a4245059e1fbe4cd3ee) Thanks [@tompahoward](https://github.com/tompahoward)! - Reject missing or conflicting MCP HTTP headers before sign-in or application
  work starts. Streamed responses now have tests proving proxy servers should not
  hold progress updates and stale stream IDs do not replay old progress.

- [#12](https://github.com/windyroad/emseepea/pull/12) [`c1bfa67`](https://github.com/windyroad/emseepea/commit/c1bfa67c16e356e5cca78898150a5386ebe5bd82) Thanks [@tompahoward](https://github.com/tompahoward)! - Add an optional dependency-readiness check and a time-limited telemetry flush
  during server shutdown. Keep dependency details out of readiness replies and
  prevent flushing before final request measurements are recorded.

- [#9](https://github.com/windyroad/emseepea/pull/9) [`3704e83`](https://github.com/windyroad/emseepea/commit/3704e83a23f4592b85fdbf5ee2e7d34bb4aae7d0) Thanks [@tompahoward](https://github.com/tompahoward)! - Let application authors advertise a server website address, validated titles,
  descriptions, icons, resource details, public application metadata, and client
  display hints. These hints do not prove safety or replace authorization. The
  framework copies these details before startup, so later application changes
  cannot alter discovery.

- [`1d11c5d`](https://github.com/windyroad/emseepea/commit/1d11c5d3b3e81a4a0231b2eff64208c72baae609) Thanks [@tompahoward](https://github.com/tompahoward)! - Reject MCP requests that do not accept both JSON and server-sent event
  responses. The request is rejected before sign-in or tool code runs.

- [#5](https://github.com/windyroad/emseepea/pull/5) [`58c5bc3`](https://github.com/windyroad/emseepea/commit/58c5bc3781af1e839c7a6b1baa09db4dec8c38ca) Thanks [@tompahoward](https://github.com/tompahoward)! - Let application authors copy checked string, integer, and boolean tool
  arguments into HTTP headers for routing. Invalid declarations, missing or
  different values, and malformed encoded values are rejected before the tool
  runs. The existing automated load test now exercises this route.

- [#6](https://github.com/windyroad/emseepea/pull/6) [`1d1bf14`](https://github.com/windyroad/emseepea/commit/1d1bf14c83f8919c0e30a6fa9cee27a647c88940) Thanks [@tompahoward](https://github.com/tompahoward)! - Guarantee that successful operations identify themselves as complete. Results
  that can be cached now have tests proving that the existing defaults tell
  clients not to reuse them or share them between callers.

- [#11](https://github.com/windyroad/emseepea/pull/11) [`4be4433`](https://github.com/windyroad/emseepea/commit/4be44335a44e78a6a8e3ffa99938631a6bf32a11) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in OpenTelemetry request traces, counts, and response times with
  `telemetry: true`. Keep application data out of framework measurements and
  preserve tool responses when telemetry APIs fail.

- [#8](https://github.com/windyroad/emseepea/pull/8) [`45f955c`](https://github.com/windyroad/emseepea/commit/45f955c7e2db378d77964b35a6ad9fa7a425fea2) Thanks [@tompahoward](https://github.com/tompahoward)! - Let applications tell clients when discovery details, lists, and resource
  content may be reused. Invalid or unavailable settings stop startup, and
  individual resources may override the shared resource-reading instruction.

- [#7](https://github.com/windyroad/emseepea/pull/7) [`8ddb3cb`](https://github.com/windyroad/emseepea/commit/8ddb3cbd2f4f79aa9cb0d8625f653d3ef3f74fdc) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in bounded pages for tool, resource, resource-address, and prompt
  catalogues. Opaque cursors work across identical server instances and reject
  changed catalogues or invalid page requests.

- [#10](https://github.com/windyroad/emseepea/pull/10) [`1250701`](https://github.com/windyroad/emseepea/commit/1250701b1d613aa850b6698f8566ad0e77db24ef) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow public tools to send progress updates through a trusted reverse proxy.
  Updates and the final result use the same HTTP response. Each new request can
  go to a different server, without sticky sessions.
  
  Existing request checks, size limits, deadlines, and cancellation still apply.
  Tools that require sign-in cannot stream in the production proxy profile yet.
  This does not add reconnect, replay, or subscriptions.

## 0.0.2

### Patch Changes

- [`d2722a1`](https://github.com/windyroad/emseepea/commit/d2722a173174ddeb11b3d17e26bd7ce8843c8ce5) Thanks [@tompahoward](https://github.com/tompahoward)! - Fix both public packages so they include the files needed to run them. Version
  0.0.1 omitted those files and should not be used.

## 0.0.1

### Patch Changes

- [`0e683cf`](https://github.com/windyroad/emseepea/commit/0e683cfb6916548551bc8b24d2365badf3750e48) Thanks [@tompahoward](https://github.com/tompahoward)! - Add a strict form display schema and native HTML form renderer to
  `@emseepea/server`. The source checkout also includes private React and
  Tailwind examples. The renderers do not approve, send, store, or change data.

- [`04321d5`](https://github.com/windyroad/emseepea/commit/04321d53bde715075091bdfea52debce5e1ebf16) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked, opt-in completion for prompt arguments and resource-template variables.

- [`2cb487e`](https://github.com/windyroad/emseepea/commit/2cb487e4249188bd44345e247e678ad8eb00b72b) Thanks [@tompahoward](https://github.com/tompahoward)! - Add mapped tools that check backend commands and results. The adapter runs
  inside the shared time limit and cancellation path. Tools can add a quick
  availability check without disappearing from discovery.
  
  Add `@emseepea/server/http`, a fixed-origin HTTPS client for read-only public
  JSON APIs. It blocks private network addresses, redirects, compressed or
  oversized responses, and non-JSON data. Adapter results are now `unknown` until
  the declared backend output schema checks them.

- [`d9461aa`](https://github.com/windyroad/emseepea/commit/d9461aa496b713b58597dbff33828c08ab48fe2f) Thanks [@tompahoward](https://github.com/tompahoward)! - Add the Fastify-first MCP server foundation, no-UI example, trusted-proxy
  boundary checks, and reproducible JSON-boundary benchmark.

- [`e2fc188`](https://github.com/windyroad/emseepea/commit/e2fc188e7e41a160b8a1afb3515a13a90310c38e) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked, bounded, loopback-only POST SSE progress for explicitly streaming
  tools, with JSON fallback when clients do not request progress.

- [`bb5f6e7`](https://github.com/windyroad/emseepea/commit/bb5f6e73d9779dcc55cc102c78525ba0ddad3934) Thanks [@tompahoward](https://github.com/tompahoward)! - Add anonymous OAuth resource metadata and invocation-scoped bearer
  verification for explicitly protected tools while keeping discovery, listing,
  and public tools anonymous.

- [`7d6efd0`](https://github.com/windyroad/emseepea/commit/7d6efd03f3c58d70a49a7c85a5e7671213b17a17) Thanks [@tompahoward](https://github.com/tompahoward)! - Publish the MIT server package under the pre-alpha `next` tag with provenance
  and exact release evidence.

- [`7ac574f`](https://github.com/windyroad/emseepea/commit/7ac574f5ed84ca926259f966df1edf618c411a4d) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked public non-enumerating resource templates with exact template
  discovery, URI-variable extraction, bounded reads, and a runnable example.

- [`a051f44`](https://github.com/windyroad/emseepea/commit/a051f443b3b974fa828fad5b67db9a717edb96fb) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked public static resources and prompts with exact capability
  advertisement, deadline-bounded handlers, validated protocol results, and a
  minimal runnable example.

- [`99eacdb`](https://github.com/windyroad/emseepea/commit/99eacdb00d2af5c8ed3191501d300a2f3d0c45ac) Thanks [@tompahoward](https://github.com/tompahoward)! - Add the public testing package and example-owned quality checks. Examples now
  carry their own deterministic tests, lint command, and semantic eval file.
