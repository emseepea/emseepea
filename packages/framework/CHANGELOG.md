# @emseepea/server

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
