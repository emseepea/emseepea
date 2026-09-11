# @emseepea/feedback

## 0.2.3

### Patch Changes

- Updated dependencies [[`7843b73`](https://github.com/emseepea/emseepea/commit/7843b73e816bd8cdb2963f71ba77a877fd98b693)]:
  - @emseepea/server@0.8.1

## 0.2.2

### Patch Changes

- Updated dependencies [[`c77d852`](https://github.com/emseepea/emseepea/commit/c77d852e729f3d809f87f8d0f4dd83774be915b0)]:
  - @emseepea/server@0.8.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`b656c8e`](https://github.com/emseepea/emseepea/commit/b656c8e86fa39a7b3dae53702eba36a582831cc7)]:
  - @emseepea/server@0.7.0

## 0.2.0

### Minor Changes

- [`da97d77`](https://github.com/emseepea/emseepea/commit/da97d777f4bfe7081c04ccf593568733d010a7b0) Thanks [@tompahoward](https://github.com/tompahoward)! - Keep the user's original request primary after feedback is submitted. The
  feedback result now reminds the AI to finish that request and disclose the
  specific observation, while routine successful tool use is explicitly excluded
  from feedback.

## 0.1.3

### Patch Changes

- Updated dependencies [[`3dd98aa`](https://github.com/emseepea/emseepea/commit/3dd98aaa73b0b7e1385e8abd758657a6f5e11f4c)]:
  - @emseepea/server@0.6.1

## 0.1.2

### Patch Changes

- Updated dependencies [[`69d5dad`](https://github.com/emseepea/emseepea/commit/69d5dada9cafc9b11e3f16dbd4c1bef6b9adba9f)]:
  - @emseepea/server@0.6.0

## 0.1.1

### Patch Changes

- [`3cd2cad`](https://github.com/emseepea/emseepea/commit/3cd2cadba6fdff8cc6aa7059a5135364a2d8a96b) Thanks [@tompahoward](https://github.com/tompahoward)! - Make AI clients state the specific feedback they recorded, and keep the native
  semantic checks focused on the observation rather than incidental wording.

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
