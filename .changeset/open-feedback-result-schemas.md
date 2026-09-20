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
