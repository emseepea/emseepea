# @emseepea/feedback

## 0.1.0

### Minor Changes

- [`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add) Thanks [@tompahoward](https://github.com/tompahoward)! - Add optional detailed feedback submissions, protected append-only support
  conversations, PostgreSQL and Firestore storage, GitHub Issues and Zendesk HTTP
  adapters, authenticated provider event ingestion, and typed application hooks.
  
  Allow every server factory to compose optional tools through `additionalTools`.
  Add a semantic assertion that successful application journeys did not record
  negative feedback, and run it against the real feedback tool in every starter.

### Patch Changes

- [`bafca2c`](https://github.com/emseepea/emseepea/commit/bafca2c7176ce5d792164f9edea07eba24edc2c0) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep feedback deadlines reliable on Node.js 22 while preserving cancellation and bounding provider response reads.
- Updated dependencies [[`55d7853`](https://github.com/emseepea/emseepea/commit/55d785354ffd1081e44b5803033bc6cfb7ba7add)]:
  - @emseepea/server@0.5.0
