---
"@emseepea/server": minor
---

Open the shared result view, so a result that embeds it can gain a field

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
