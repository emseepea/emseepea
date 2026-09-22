# @emseepea/server

## 0.18.0

### Minor Changes

- [`6a6abdd`](https://github.com/emseepea/emseepea/commit/6a6abddabe158c406c82a0fef6edd7147a4b99e2) Thanks [@tompahoward](https://github.com/tompahoward)! - Read the forwarded client address by counting from the end, so a proxy that appends to `x-forwarded-for` can be read correctly

  `production-behind-proxy` refused every request that arrived through a proxy which appends its own address after the client's. The check accepted a single entry and nothing else. An appending proxy always sends at least two, so it could not be put in front of a server in this mode. A proxy that replaces the header with the caller's address, leaving one entry, was already accepted and needs no change.

  The production profile takes a new optional `forwardedHops`: how many entries the infrastructure in front appends after the client address. It defaults to `0`, which keeps the behaviour it had, so no existing configuration becomes invalid and no allowlist widens.

  At `0` the header must carry the client and nothing else. That strictness is deliberate rather than legacy: with nothing trustworthy appending, a second entry can only have come from the caller, so the header is not evidence of anything and is refused rather than read.

  At `1`, one proxy appends its own address after the client, and the client is the entry just before it. Anything earlier in the header was supplied by the caller and is ignored.

  Counting from the end is the point of the change. Reading the first entry is the obvious way to accept a longer header and it is the wrong one, because the first entry becomes the rate-limit key: a caller who prepends a different value each time would never be limited. There is a test for exactly that, with a budget of one request, two calls differing only in the caller-supplied prefix, and the second refused.

  Set the count from what your deployment actually sends, not from what a platform is documented to do. Log the raw `x-forwarded-for` from a request you make yourself, count the entries that appear after your own address, and use that number.

  Both wrong values fail, in different ways. The dangerous one is a count higher than the truth.

  A count higher than the truth moves the position being read into the part of the header a caller controls. A caller who prepends their own value is served, and the rate limit never catches them. Nothing reports it. Honest callers, whose header is shorter than the count expects, are refused instead, and that refusal is the only visible sign.

  A count lower than the truth reads an address your own infrastructure appended as though it were the client. Every caller then shares one rate limit. That is wrong too, but you see it at once, because the limit starts applying to everyone together.

  Counting from the end keeps a caller out of the key only while the count is right. Nothing in the framework detects a count that is too high.

  The entries after the client are counted, not checked. The count on its own picks out the client address, so it has to match your deployment exactly.

  Entries are trimmed before they are read. That matters most for a multi-entry header, because senders usually separate with a comma and a space, and address parsing rejects a value with a leading space. A single padded entry is accepted too.

  This addresses the header shape only. A deployment whose proxy has no stable address still cannot satisfy `trustedProxyAddresses`, and that part of the report remains open.

  Reported in [#120](https://github.com/emseepea/emseepea/issues/120).

- [`bb39bfa`](https://github.com/emseepea/emseepea/commit/bb39bfa6b0a350468472f8956a2cd44711cab754) Thanks [@tompahoward](https://github.com/tompahoward)! - Let a proxy with no fixed address prove itself with a secret header

  A server behind a load balancer with no stable address could not start in
  `production-behind-proxy` mode. The profile required `trustedProxyAddresses`,
  which takes literal addresses only, and platforms like Cloud Run behind an
  external load balancer present nothing stable to list. The
  server refused to start, the container never listened, and the deploy failed.

  The profile now takes `proxyBoundary` instead: a header name and a secret. The
  proxy is configured to add that header, and the server refuses any request
  that does not carry it.

  Supply exactly one of `trustedProxyAddresses` and `proxyBoundary`. A profile
  with both is refused, and so is one with neither. The secret must be at least
  32 characters, and the header cannot be a forwarding header.

  The header check replaces the address check and changes nothing else. The
  forwarded-protocol, authority, origin and rate-limit checks all still run.

  Configure the header on the proxy first. Until the proxy is sending it, every
  request is refused. A mistake here closes the server rather than opening it.
  That is why the server checks a secret instead of trusting a setting.

  The secret is a credential. Supply it from your platform's secret store rather
  than the deployment file: the file names the environment variable holding the
  value, so it stays non-secret policy. The value is compared in constant time,
  and this package never writes it to a log or sends it to an observability
  adapter. Rotate it as you would any other credential.

  Check your own infrastructure too. The secret travels as a request header, and
  proxies and CDNs often log request headers by default. Turn off logging for
  that header at your proxy and anything in front of it.

  Reported in [#119](https://github.com/emseepea/emseepea/issues/119).

## 0.16.0

### Minor Changes

- [`ed936ec`](https://github.com/emseepea/emseepea/commit/ed936ec494c9c5e5f70f9ee7677b886dcc2354f7) Thanks [@tompahoward](https://github.com/tompahoward)! - Open the shared result view, so a result that embeds it can gain a field

  The result view exported from this package (`resultViewSchema`) declared every
  one of its objects with `z.strictObject`, which publishes a closed contract. A
  closed schema rejects any field it does not list. An open schema allows them.

  So a client validating a tool result against a captured copy of that schema had
  to reject any field the view gained later. Adding a field to the result view was
  a breaking change for that client. The view now publishes an open contract.

  #### What you need to do: re-capture your baselines once

  Your contract baselines — the stored copies of the schemas you published last
  time — will report a break once, on any tool whose result embeds the result
  view. Re-capture them after upgrading:

  ```
  npx emseepea-contract capture
  ```

  #### Read this if you upgraded to 0.15.0

  You get a second baseline break here, on a surface the 0.15.0 note implied was
  settled. Here is what happened.

  The 0.15.0 note said schemas written with `z.strictObject` stayed closed and
  that nothing changed for them. That is still true. `z.strictObject` still
  publishes a closed contract, and it is still how you ask for one. What changed
  is our code, not the rule. The result view used to be written with
  `z.strictObject`. We have rewritten it, so it now publishes open.

  #### What did not change

  Results still carry only their declared fields. Opening the published schema
  tells clients to tolerate a field added later; it does not make the server send
  anything new.

  Your own schemas are untouched. If you declared a result with `z.strictObject`,
  it still publishes closed, and that is still the way to ask for a closed
  contract deliberately.

  One exception, which we are not going to leave you to discover: if you build
  that schema by piping an open object into a strict one, it publishes open today.
  That is a defect on our side, it arrived before this release, and it is not
  fixed here. It is recorded as Problem 006 in this project's backlog.

  #### If you call `defineResultView` or `parseResultView`

  You lose one check. These two functions used to reject a view that contains a
  key the result view does not declare. They now drop that key and return the
  rest. You no longer get an error from a typo in a view you build, or from an
  unexpected field in a payload you received from elsewhere.

  Nothing undeclared reaches the view these functions return — the key is
  removed, not carried through. What you lose is being told about it.

  To keep that check, validate the view against your own strict schema before you
  pass it to `defineResultView` or `parseResultView`.

  Check one thing in your own code: use the value these functions return, not the
  object you passed in.

  Before, an undeclared key made the call throw, so the two could never differ.
  Now the call succeeds. The returned value has the key removed. The object you
  passed in still has it. If you go on using the original, you are working with a
  key the result view does not declare.

  #### Will this happen again?

  Not on these surfaces, and you do not have to take our word for it. The shared
  result view and all five feedback tools now publish open, and two tests hold
  them that way. One walks every object in the result view and fails if any of
  them is closed. The other does the same for all five feedback tools and names
  the exact path of any closed node it finds. Closing one of these schemas again
  would fail both tests before it could ship.

  You can also check this in your own project, without reading our code. After you
  re-capture, open the baseline for one of these tools: an open schema does not
  carry `"additionalProperties": false`.

  The two tests are in this project's source repository:

  - `tests/black-box/output-schema-openness.test.mjs`
  - `packages/feedback/test/result-schema-openness.test.mjs`

  These tests cover the result view and the feedback tools. A result schema added
  somewhere else later is not covered by them.

## 0.15.0

### Minor Changes

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

## 0.14.0

### Minor Changes

- [`9eed174`](https://github.com/emseepea/emseepea/commit/9eed174d916de6280eae9f5f52467fb7d6a18769) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in caller classification that reports configured IDs instead of raw
  `User-Agent` headers.

## 0.13.0

### Minor Changes

- [`12f06ce`](https://github.com/emseepea/emseepea/commit/12f06ce22fc320e9008ff67434eb72119c84c72b) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow `defineMcpAppResource` callers to preserve an established
  `text/html+skybridge` contract. The existing `text/html;profile=mcp-app`
  default remains unchanged, and the selected value is used for both resource
  listing and returned content.

## 0.12.1

### Patch Changes

- [`4d2c4c5`](https://github.com/emseepea/emseepea/commit/4d2c4c5e2df1c7bf626f704b6fe2a0d7cfd92174) Thanks [@tompahoward](https://github.com/tompahoward)! - Add `defineMcpAppResource` to package a Model Context Protocol (MCP) App HTML
  resource with matching MCP Apps `ui` metadata and ChatGPT Apps compatibility
  aliases. The helper validates the URI, script, language, and content security
  policy (CSP) when the resource is defined. Update the React UI starter to use
  the helper; keep the other starters' embedded server dependency aligned with
  this release.

## 0.12.0

### Minor Changes

- [`2e1258e`](https://github.com/emseepea/emseepea/commit/2e1258ea3eb04bd2b7cbf048e8056654f065a797) Thanks [@tompahoward](https://github.com/tompahoward)! - Add bounded protocol outcomes to redacted observability events.

## 0.11.2

### Patch Changes

- [`5a65ff8`](https://github.com/emseepea/emseepea/commit/5a65ff82d5e06f798cc063a59f3eff310f2f1d66) Thanks [@tompahoward](https://github.com/tompahoward)! - Add bounded request-scoped progress reporting to static resources, resource
  templates, and prompts. Handlers receive `reportProgress` only when the current
  request supplies a progress token, with existing event-count and event-size
  limits.

## 0.11.1

### Patch Changes

- [`aba65fa`](https://github.com/emseepea/emseepea/commit/aba65faf63b00b62ab4503fdeecc42120be88667) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow static resources and resource templates to return multiple validated text
  or binary content items. Each item's URI may differ from the URI of the
  requested resource. Em See Pea still authorizes the requested resource, and any
  cache instructions apply to the complete response.

  Returning an item URI does not, by itself, register a resource or let a client
  read that URI through Em See Pea. A client may still read it if the URI
  separately identifies an already registered static resource or matches an
  already registered resource template, and the client satisfies that
  capability's access policy.

## 0.11.0

### Minor Changes

- [`cb69374`](https://github.com/emseepea/emseepea/commit/cb693744387d52d31c463c939094282efb216c6c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add a validated, accessible tool-result view model and native renderer, React
  and Svelte `ResultCard` components, and standards-first MCP Apps lifecycle
  bindings. Update the React UI server example to use the public result APIs.

## 0.10.3

### Patch Changes

- [`34bd2b3`](https://github.com/emseepea/emseepea/commit/34bd2b3ca147cd359bc22ac06aa8a78f9044d69c) Thanks [@tompahoward](https://github.com/tompahoward)! - Add checked protocol-native MCP tool results while preserving existing structured convenience handlers.

## 0.10.2

### Patch Changes

- [`2c97dfb`](https://github.com/emseepea/emseepea/commit/2c97dfbb4cb0dd422675ea77fbe40ba35cbf2e54) Thanks [@tompahoward](https://github.com/tompahoward)! - Document and preserve the intentional rejection of deprecated MCP Sampling.

## 0.10.1

### Patch Changes

- [`60e987a`](https://github.com/emseepea/emseepea/commit/60e987aec3796f248f29760e2a7eac0a4984564a) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep type inference responsive when `defineTool`, `defineStreamingTool`, or `defineMappedTool` use large Zod output schemas. Handler output checks remain unchanged.

## 0.10.0

### Minor Changes

- [`89f450d`](https://github.com/emseepea/emseepea/commit/89f450dfb1daf662dcd1ae4c4ec0bf7619dfe24b) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional checked client roots through MCP input-required rounds. Direct
  tools, resources, resource templates, and prompts can request workspace roots.
  Validate roots before handlers run and preserve authorization on every round.

## 0.9.1

### Patch Changes

- [#69](https://github.com/emseepea/emseepea/pull/69) [`7454904`](https://github.com/emseepea/emseepea/commit/7454904f4561a966ac72063f4a9ce2eda2c37578) Thanks [@tompahoward](https://github.com/tompahoward)! - Add safe production container builds to every standalone initializer, backed by
  a fail-closed deployment-file loader and centralized npm commands.

## 0.9.0

### Minor Changes

- [`02fe020`](https://github.com/emseepea/emseepea/commit/02fe0209e7a934415d46681678497dfd993f72ec) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in, bounded MCP 2026-07-28 request-scoped client log messages.

## 0.8.1

### Patch Changes

- [`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693) Thanks [@tompahoward](https://github.com/tompahoward)! - Support five named legacy Model Context Protocol (MCP) revisions through the existing stateless POST endpoint while retaining MCP 2026-07-28 as the active protocol target.
  Refresh every maintained initializer so newly generated projects install this server release.

## 0.8.0

### Minor Changes

- [`c77d852`](https://github.com/emseepea/emseepea/commit/c77d852e729f3d809f87f8d0f4dd83774be915b0) Thanks [@tompahoward](https://github.com/tompahoward)! - Add opt-in, SDK-signed MCP request state for direct tools, resources, resource
  templates, and prompts.

## 0.7.0

### Minor Changes

- [#58](https://github.com/emseepea/emseepea/pull/58) [`b656c8e`](https://github.com/emseepea/emseepea/commit/b656c8e86fa39a7b3dae53702eba36a582831cc7) Thanks [@tompahoward](https://github.com/tompahoward)! - Add bounded `subscriptions/listen` support for updates to registered static
  resources and concrete resource-template URIs.

## 0.6.1

### Patch Changes

- [`3dd98aa`](https://github.com/emseepea/emseepea/commit/3dd98aaa73b0b7e1385e8abd758657a6f5e11f4c) Thanks [@tompahoward](https://github.com/tompahoward)! - Allow protected tools to stream bounded POST-scoped progress in production
  after authentication and authorization succeed behind a trusted proxy.

## 0.6.0

### Minor Changes

- [`69d5dad`](https://github.com/emseepea/emseepea/commit/69d5dada9cafc9b11e3f16dbd4c1bef6b9adba9f) Thanks [@tompahoward](https://github.com/tompahoward)! - Add a backwards-compatible `discoverable` flag for hiding tools, resources,
  resource templates, and prompts from discovery while keeping known direct calls
  available under their existing access policy.

## 0.5.0

### Minor Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.

  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

## 0.4.0

### Minor Changes

- [`aad5a79`](https://github.com/emseepea/emseepea/commit/aad5a7963ae6108918f8b98742b882524a205d3a) Thanks [@tompahoward](https://github.com/tompahoward)! - Add typed authentication, permission-shaped discovery, and framework-redacted
  observability adapters. Every initializer now demonstrates open and protected
  composition from the same app factory. Retire the redundant sign-in initializer.

## 0.3.3

### Patch Changes

- [`6c6d544`](https://github.com/emseepea/emseepea/commit/6c6d544ed45b8b4bb7b1f83a8f4e9efcea171f9a) Thanks [@tompahoward](https://github.com/tompahoward)! - Make validated structured tool data the default result. Tool handlers can omit
  custom text, and Em See Pea will return the same data as `structuredContent`
  and serialized JSON text for compatibility. The maintained tool examples now
  demonstrate this smaller pattern.

## 0.3.2

### Patch Changes

- [`cec4ca3`](https://github.com/emseepea/emseepea/commit/cec4ca372b27978041668223ed76a368dd012d56) Thanks [@tompahoward](https://github.com/tompahoward)! - Describe every public example input and output property in the MCP schemas sent to clients.

## 0.3.1

### Patch Changes

- [`7053c47`](https://github.com/emseepea/emseepea/commit/7053c4719a6ec55ce8d09c3381e040c503118749) Thanks [@tompahoward](https://github.com/tompahoward)! - Remove repeated schema declarations and use matching schema variable names in maintained starter code and framework guidance.

## 0.3.0

### Minor Changes

- [`f673477`](https://github.com/emseepea/emseepea/commit/f6734775b5b7b5160312a394d16954d9959637ea) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional deterministic HTTP route discovery and use it in both UI server templates.

## 0.2.2

### Patch Changes

- [`8ed59f9`](https://github.com/emseepea/emseepea/commit/8ed59f945e62544a034b8a88b88f8ceed08cb234) Thanks [@tompahoward](https://github.com/tompahoward)! - Rename each example directory to match its initializer command and package name,
  use one garden pea theme throughout, and publish every public package on npm's
  default `latest` channel. Update links, documentation, tests, scripts, and
  generated projects to match.

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
