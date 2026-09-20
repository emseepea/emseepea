# Problem 009: A Tool Call Can Fail After the Backend Has Recorded the Work

**Status**: Open
**Reported**: 2026-09-20
**Priority**: 12 (High) — Impact: 4 × Likelihood: 3 — the caller is told an operation failed when it succeeded, and a caller that retries records the work twice; the first two cases need an adapter to return something the checks reject, which is uncommon but not exotic, while the size limits need only a thread that grows
**Origin**: internal
**Effort**: M (medium) — the fix is a boundary move rather than a rule change, and one half of it collides with a check this project deliberately keeps
**Jobs To Be Done (JTBD)**: JTBD-101 — a job to be done: publish installable packages safely
**Persona**: framework-maintainer

## Description

A feedback backend records something durably and then returns a receipt
describing it. We check that receipt after the write has happened. When a check
rejects it, the tool call fails — so the caller is told the operation failed
when it succeeded, and a caller that retries records the work a second time.

Most of this was fixed while shipping open result schemas. The list of events
and everything in it is now handled where a failure is survivable: an event we
cannot read is skipped, and that holds for its contents, for whether a list
arrived at all, for how many arrived, and for a list that throws while being
read. Reading the `events` property itself is not covered, because that read
happens earlier. Three cases are left.

**The events property itself.** `events` is a declared key of the result
schemas, so the parse reads the property before the guarded code is reached. A
backend whose `events` is a getter that throws still fails the call. The obvious
fix — stop declaring the key and read it inside the guard — collides with the
three conversation wrappers being strict: an undeclared key is rejected there,
which is the behaviour this project deliberately keeps so an adapter's typo at
the top level is still reported.

**The rest of the receipt.** A result with no identifier, or a timestamp we
cannot read, still fails the call after the write. That is arguably right, since
those two fields are the receipt and there is no honest result without them. It
is recorded here so the decision is made rather than inherited.

**Size and shape limits on the conversation results.** `get-feedback-thread`
returns the whole conversation, so a thread that grows past two hundred
messages, or that holds a message body over four thousand characters, fails
every read from then on. The thread stays readable in the backend and
unreadable through the tool, and a retry never helps. This one needs no unusual
adapter: an ordinary support thread reaches the limit by growing. The limits are
the same shape as the event cap that was moved off the fatal path, with a larger
number.

## Symptoms

- A caller receives a failed tool call for feedback that was recorded, a thread
  that was created, or a message that was appended.
- Retrying records the work again, because the first attempt did succeed.
- For the size limits, retrying does not help: the call fails every time until
  the data shrinks.
- Nothing in the failure names the backend's return value as the cause.

## Workaround

In a backend, return a receipt that satisfies the declared shape: an identifier,
a timestamp we can read, no unexpected top-level keys, and content within the
declared limits (at most 200 messages in a thread, 4,000 characters in a message
body). Do not expose `events` as a getter.

## Impact Assessment

- **Who is affected**: adopters who implement a feedback backend, and the
  callers of their servers.
- **Frequency**: on any return that fails a check applied after the write.
- **Severity**: the caller is misinformed and may duplicate the work. No data is
  exposed and nothing undeclared reaches a client.
- **Analytics**: found during the release that opened result schemas, by a risk
  review of that change. Not observed in the field.

## Root Cause Analysis

### Investigation Tasks

- [ ] Decide which parts of a receipt may fail a call after the write, and which
  must be tolerated because the work is already done.
- [ ] Move the `events` property read inside the guard without losing the
  strict top-level check on the conversation wrappers.
- [ ] Give an adapter author a signal when an event is skipped, so a mistake is
  not an invisible dead hook.
- [ ] Create a reproduction test for each case kept in scope.

## Dependencies

- **Blocks**: (none)
- **Blocked by**: (none)
- **Composes with**: (none)

## Related

- `packages/feedback/src/index.ts` — `dispatchHooks` and `dispatchEachEvent`
  hold the guarded path; the result schemas that declare `events` are
  `submissionResultSchema`, `createThreadResultSchema`,
  `appendMessageResultSchema` and `getThreadResultSchema`.
- `packages/feedback/test/durable-record-survives-bad-event.test.mjs` pins what
  is already survivable, across the four tools that hand events to hooks.
- The release note for opening the feedback result schemas states the open case
  so adopters are not left to find it.
- Captured at the maintainer's direction after a risk review raised it during
  that release, and after four rounds of review each found another instance of
  the same shape. The guard was rewritten to be total by construction rather
  than by listing hazards, which is why the remaining cases are the ones outside
  it rather than more of the same.
