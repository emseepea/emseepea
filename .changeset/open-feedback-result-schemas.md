---
"@emseepea/feedback": minor
---

Open the feedback tools' result schemas, so they can gain a field

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

#### If you implement a feedback backend

You lose one check. An unexpected key nested inside a conversation or a message
is now dropped rather than reported. It is still never sent to a client.

The schemas that check what your adapter returns are still strict at the top
level, so an unexpected top-level key is still rejected. To keep the nested
check, validate your adapter's return value against your own strict schema
before you return it.

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
