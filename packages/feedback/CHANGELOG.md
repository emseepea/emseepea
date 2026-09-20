# @emseepea/feedback

## 0.3.0

### Minor Changes

- [`ed936ec`](https://github.com/emseepea/emseepea/commit/ed936ec494c9c5e5f70f9ee7677b886dcc2354f7) Thanks [@tompahoward](https://github.com/tompahoward)! - Open the feedback tools' result schemas, so they can gain a field

  The four conversation tools and the submission tool published closed result
  schemas. A closed schema rejects any field it does not list. An open schema
  allows them.

  So a client validating a result against a captured copy of one of those schemas
  had to reject any field the result gained later. Adding a field was a breaking
  change for that client. That included clients working from a tool list captured
  at marketplace submission time rather than read from the running server.

  The schemas these tools publish are now open.

  #### What you need to do: re-capture your baselines once

  Your contract baselines — the stored copies of the schemas you published last
  time — will report a break once, on `submit-feedback`,
  `create-feedback-thread`, `reply-to-feedback-thread`, `list-feedback-threads`
  and `get-feedback-thread`. Re-capture them after upgrading:

  ```
  npx emseepea-contract capture
  ```

  #### Read this if you upgraded to 0.15.0

  You get a second baseline break here, on a surface the 0.15.0 note implied was
  settled. Here is what happened.

  The 0.15.0 note said schemas written with `z.strictObject` stayed closed and
  that nothing changed for them. That is still true. `z.strictObject` still
  publishes a closed contract, and it is still how you ask for one. What changed
  is our code, not the rule. These schemas used to be written with
  `z.strictObject`. We have rewritten them, so they now publish open.

  Nothing recorded said these results were meant to be closed. They were written
  that way out of habit, not as a promise we are now breaking.

  #### What did not change

  Results still carry only their declared fields.

  Your own schemas are untouched. If you declared a result with `z.strictObject`,
  it still publishes closed, and that is still the way to ask for a closed
  contract deliberately.

  One exception, which we are not going to leave you to discover: if you build
  that schema by piping an open object into a strict one, it publishes open today.
  That is a defect on our side, it arrived before this release, and it is not
  fixed here. It is recorded as Problem 006 in this project's backlog.

  #### A recorded submission no longer fails on an event we cannot read

  This release also fixes a defect. Your backend records the feedback and returns
  a receipt to us, along with any events. We used to check those events strictly
  at that point, so an event we could not read turned a submission you had already
  recorded into a failed tool call. The caller saw a failure for work that had
  happened.

  Events are now checked only when we hand them to your hooks. An event we cannot
  read is skipped and the call still succeeds. The same is true for:

  - what is in an event
  - whether you sent a list at all
  - how many you sent: we stop after the first hundred rather than rejecting the
    result
  - a list that throws when we read through it

  The same is true for all four tools that hand events to hooks: `submit-feedback`,
  `create-feedback-thread`, `reply-to-feedback-thread` and `get-feedback-thread`.
  `list-feedback-threads` sends no events, and it rejects them if you add them.

  This covers the events only. Everything else you return is still checked, and a
  result that fails a check still fails the call even though you already recorded
  the work. A submission needs an identifier and a timestamp we can read. A
  conversation result must also stay inside the declared limits: at most 200
  messages in a thread, and at most 4,000 characters in a message body. One case is still open. If `events` is a getter, a proxy, or anything else that
  runs code when we read it, and that read throws, the call still fails. The list
  itself is safe; reading the property is not. Return your events as a plain value
  you worked out before you return. This is recorded as Problem 009 in this
  project's backlog.

  What this means for you: a hook may silently never run for an event. If a hook
  does work you depend on, do that work in your backend before you return.

  #### If you implement a feedback backend

  Some of what you return is now checked less closely. Nothing unexpected reaches
  a client either way.

  One check on unexpected keys is unchanged: if you implement a conversation
  backend, an unexpected key at the top level of what you return is still
  rejected.

  Everywhere else, an unexpected key no longer fails the call. Nested inside what
  you return, and at the top level of what a submission backend returns, it is
  dropped quietly. Inside an event, the whole event is skipped — you lose the
  event, not just the key.

  To have an unexpected key reported to you instead, validate your return value
  before you return it against a schema of your own that is strict at every level.
  A strict wrapper around the result schemas this package exports will not do it:
  those are open.

### Patch Changes

- Updated dependencies [[`ed936ec`](https://github.com/emseepea/emseepea/commit/ed936ec494c9c5e5f70f9ee7677b886dcc2354f7)]:
  - @emseepea/server@0.16.0

## 0.2.17

### Patch Changes

- Updated dependencies [[`0b6b5ae`](https://github.com/emseepea/emseepea/commit/0b6b5ae5e58d39ff2fe2edc14b01571677f382b6)]:
  - @emseepea/server@0.15.0

## 0.2.16

### Patch Changes

- Updated dependencies [[`9eed174`](https://github.com/emseepea/emseepea/commit/9eed174d916de6280eae9f5f52467fb7d6a18769)]:
  - @emseepea/server@0.14.0

## 0.2.15

### Patch Changes

- Updated dependencies [[`12f06ce`](https://github.com/emseepea/emseepea/commit/12f06ce22fc320e9008ff67434eb72119c84c72b)]:
  - @emseepea/server@0.13.0

## 0.2.14

### Patch Changes

- Updated dependencies [[`4d2c4c5`](https://github.com/emseepea/emseepea/commit/4d2c4c5e2df1c7bf626f704b6fe2a0d7cfd92174)]:
  - @emseepea/server@0.12.1

## 0.2.13

### Patch Changes

- Updated dependencies [[`2e1258e`](https://github.com/emseepea/emseepea/commit/2e1258ea3eb04bd2b7cbf048e8056654f065a797)]:
  - @emseepea/server@0.12.0

## 0.2.12

### Patch Changes

- Updated dependencies [[`5a65ff8`](https://github.com/emseepea/emseepea/commit/5a65ff82d5e06f798cc063a59f3eff310f2f1d66)]:
  - @emseepea/server@0.11.2

## 0.2.11

### Patch Changes

- Updated dependencies [[`aba65fa`](https://github.com/emseepea/emseepea/commit/aba65faf63b00b62ab4503fdeecc42120be88667)]:
  - @emseepea/server@0.11.1

## 0.2.10

### Patch Changes

- Updated dependencies [[`cb69374`](https://github.com/emseepea/emseepea/commit/cb693744387d52d31c463c939094282efb216c6c)]:
  - @emseepea/server@0.11.0

## 0.2.9

### Patch Changes

- Updated dependencies [[`34bd2b3`](https://github.com/emseepea/emseepea/commit/34bd2b3ca147cd359bc22ac06aa8a78f9044d69c)]:
  - @emseepea/server@0.10.3

## 0.2.8

### Patch Changes

- Updated dependencies [[`2c97dfb`](https://github.com/emseepea/emseepea/commit/2c97dfbb4cb0dd422675ea77fbe40ba35cbf2e54)]:
  - @emseepea/server@0.10.2

## 0.2.7

### Patch Changes

- [`e9bdc75`](https://github.com/emseepea/emseepea/commit/e9bdc756d9b54525fe33bc8a730bb1c49088a0ac) Thanks [@tompahoward](https://github.com/tompahoward)! - Make the testing server report readiness only after its shutdown handlers are active.
- Updated dependencies [[`60e987a`](https://github.com/emseepea/emseepea/commit/60e987aec3796f248f29760e2a7eac0a4984564a)]:
  - @emseepea/server@0.10.1

## 0.2.6

### Patch Changes

- Updated dependencies [[`89f450d`](https://github.com/emseepea/emseepea/commit/89f450dfb1daf662dcd1ae4c4ec0bf7619dfe24b)]:
  - @emseepea/server@0.10.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`7454904`](https://github.com/emseepea/emseepea/commit/7454904f4561a966ac72063f4a9ce2eda2c37578)]:
  - @emseepea/server@0.9.1

## 0.2.4

### Patch Changes

- Updated dependencies [[`02fe020`](https://github.com/emseepea/emseepea/commit/02fe0209e7a934415d46681678497dfd993f72ec)]:
  - @emseepea/server@0.9.0

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
