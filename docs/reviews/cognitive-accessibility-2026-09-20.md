# Cognitive Accessibility Review - 2026-09-20

## Ungated Branch Push Problem Ticket

Result: PASS. An independent cognitive-accessibility specialist reviewed the new
problem ticket and the two backlog index files it updates, across four rounds.
Every finding from every round was applied, and the fourth round returned a
clean pass with no findings.

The first round found an abbreviation used unexpanded in the title and then
never reused in the body, so the backlog index and the ticket named the same
thing two different ways; a priority line carrying five facts across two dashes,
a semicolon and a colon, resting on an unnamed policy file; an effort grade and
a job identifier each standing in for an explanation the reader never receives;
a six-item list buried in one run-on sentence; and a paragraph in the passive
voice that interleaved two failure classes so the reader had to track both
threads at once.

The second round found a figurative summary line in place of a term the document
already used literally, an undefined property that carried the whole force of a
comparison, an unexpanded abbreviation in a field whose gloss named the job
rather than the abbreviation, a comma splice joining two contrasting clauses
across forty-one words, and a single sentence stacking a claim, its cause and
its evidence.

The third round found two outright contradictions the earlier rounds had not
reached. The ticket credited "the gate" with holding, in a document whose whole
premise is that no gate exists at that boundary; the intended referent was CI
blocking the merge. And it left "Investigate root cause" unticked above a
completed root cause analysis, telling the reader either that the analysis was
untrusted or that the checklist was boilerplate, with no way to tell which. It
also found a broken parallel that left a sentence without a readable second
clause, an unresolvable reference to an unnamed commit relative to an unnamed
event, a term used four sentences before the concept it depends on, a missing
unit, and four unexplained modifiers stacked in the one comparison the Related
section exists to make.

All of those are fixed. The contradictions are removed: CI is named as what
blocked the merge, and the completed analysis no longer sits under an open
instruction to perform it. The commit that refreshed the lockfile is named
directly. The exact-commit requirement is explained before the term is used.
The sibling ticket is named and its gap described in plain words.

The rounds were not diminishing. Each reached defects the previous had not,
including two contradictions in the third, and the fourth then passed cleanly.
An earlier version of this record stopped after the second round and described
the remaining findings as polish on prose already restructured once. That was
wrong on the facts.

- `docs/problems/open/005-branch-push-is-ungated-so-untested-changes-reach-ci.md`
  SHA-256: `65ef7cf5cd8f05fa98727fb34013944c54be4f7f32aabf92eb273484671a925c`
- `docs/problems/README.md`
  SHA-256: `0ae12b19de753b8804db223b430e62150ddf82e8bf225231dbe06ce9c05a6786`
- `docs/problems/README-history.md`
  SHA-256: `4ee8ce662aa7b6b16570d73c852889b56977dabad713b26fbdbaa25aa7d48f5b`

## Two Job Records Amended and Re-Ratified

Result: PASS. An independent cognitive-accessibility specialist reviewed both
job records across two rounds. Every finding was applied, and the second round
returned a clean pass with no findings.

The first round found five defects, all in prose that predated this change: the
abbreviation naming the record type was never expanded; "checked with the same
revision" read two ways, since "revision" could mean either the behaviour change
or a documentation revision; an outcome told the reader to test examples
"outside the monorepo", which is undefined jargon and packs two actions into
four words, in a record whose own constraint asks for language a developer can
follow without knowing the release process; a protocol abbreviation appeared
only in machine-readable metadata and was never expanded in prose, in a document
that carefully expands a different abbreviation on first use; and an outcome
requiring checks that work "without model access" could mean either that the
checks must never call a model or that they must survive a model being
unavailable, which are different requirements.

All five are fixed. Four of the fixes are described next; the fifth, the
model-access ambiguity, is described two paragraphs below because it needs more
than a sentence. Both records now open by saying what a job-to-be-done record
is. The ambiguous "revision" is now "that same change". The example outcome now
says to copy an example out of the repository and run it elsewhere, to prove it
works without the repository's own setup. The protocol is named in full on first
use.

A sixth change was made that does not correspond to any recorded finding. An
outcome that read "Review published writing for clarity and cognitive
accessibility" now reads "Review published writing for clarity, including
whether someone who finds dense text hard to follow can still act on it". This
was an unprompted edit, not a fix to a finding, and it carries a real cost: the
record no longer names the discipline anywhere, so a reader of that line alone
does not learn that the whole standard is in scope. The word "including" keeps
the list open, so nothing is formally excluded. It was made because the record's
own persona constraint asks for language a developer can follow without knowing
the release process, and the discipline's name did not meet that bar. The
tradeoff is recorded here rather than presented as a pure improvement, and the
amended wording is what Tom Howard re-ratified.

The ambiguous model-access outcome was not split into two. It was resolved in
place by choosing one reading, "checks that never call a model", and the
existing outcome about calling a model was reworded to make the division
explicit. The other reading, that checks must survive a model being unavailable,
was dropped deliberately, because the existing outcome already made the chosen
reading the intended one.

These were not defects introduced by this change, and an earlier version of this
record proposed leaving them in place to protect the confirmation markers the
records already carried. That was the wrong call: it would have left a known
defect in the corpus for the next reader. The records were amended instead, the
markers cleared, and Tom Howard re-ratified both amended statements. The digests
below are the amended, re-ratified files.

- `docs/jtbd/framework-maintainer/JTBD-102-keep-guidance-accurate.proposed.md`
  SHA-256: `795d466b2bba75e3114354dade724fe279a78d31bd42158522cc815873359382`
- `docs/jtbd/mcp-server-developer/JTBD-003-prove-an-ai-understands-the-result.proposed.md`
  SHA-256: `723ba2dc419c1dd526c2807f334a4009d1e0aa549466c09b461b4cb1ca141fcb`

## Jobs To Be Done Index

Result: PASS. The index carried a blanket statement that its jobs "still need
human review". That became false once every job and persona in the corpus was
confirmed, which happened in this same session. The index now states that every
record has been reviewed and confirmed by a person and carries the date, and
separates that from the "proposed" status, which tracks whether a job has been
validated against real use rather than whether a person agreed it is real. The
two were previously easy to read as one claim.

The universal claim was checked before it shipped, not assumed: every one of the
fifteen job and persona records under `docs/jtbd/` carries a confirmation marker
and a date. The claim is narrowed to nothing, because nothing is unconfirmed.

- `docs/jtbd/README.md`
  SHA-256: `2c0592d72782f57355d48a98b2f8c7a62d4b70a9ed2902d14d42447e39bed111`

## Release Readiness Record

Result: ISSUES FOUND, not applied. An independent cognitive-accessibility
specialist reviewed the rewritten release readiness record and returned 27
findings. None were applied.

That is a deliberate choice, recorded rather than hidden. The record was
rewritten mid-release to correct a false claim: it had described a package set
from the previous release, and it carried a review-authority framing that
implied a person had checked the package set when an agent wrote it. Both are
fixed. The document now states plainly who wrote it, which reviews were separate
from the author, that those reviewers are also agents rather than people, and
which of them left a durable file.

The 27 findings concern how readable that account is, not whether it is true.
The eleven that fall on the two load-bearing sections, Evidence So Far and Known
Limits of This Review, were then applied: those sections now name an actor for
each claim, say that two bare identifiers are commits, explain what writing a
test first and watching it fail proves, state that the risk scale runs to 25
where lower is better and that this project accepts up to 5, and say plainly
what an adopter faces from the defect that ships without a fix. The remaining
sixteen findings, on the surrounding sections, were not applied.

The record was amended after this review. Two disclosure sections were added:
one naming both cognitive-accessibility records and their separate coverage, and
one recording these unapplied findings in its limits. The reviewer never saw
either. The digest below covers the amended file, so it binds the evidence to
what ships rather than to what was read.

- `docs/reviews/current-release-readiness.md`
  SHA-256: `5e7b3cf928fce036859f0fe7812941671fa0a6070021601fbf560bf227fd3087`

## Two Problem Records From This Release

Result: ISSUES FOUND, not applied. An independent cognitive-accessibility
specialist reviewed both new problem records and returned 18 findings. None were
applied.

Both records exist because this release ships with two known gaps that needed a
home outliving the release readiness record, which is replaced each release. One
covers a correctness defect: a strict result schema has its closure dropped when
it is piped from an open object. The other covers a guidance defect: the package
guide shipped inside the server package does not mention the new default or the
way to declare a closed contract.

The findings concern how readable the two records are, not whether they are
accurate. Applying them is owed. The maintainer directed that the release
proceed through the standard process rather than another review cycle, and
holding a release to reword an internal backlog ticket would be the wrong trade.

- `docs/problems/open/006-strict-result-schema-opens-when-piped-from-an-open-object.md`
  SHA-256: `479abc52e158d626a9df28589fbcff9226fd6d6f6bd4061e1267bcd84e4aeb00`
- `docs/problems/open/007-shipped-package-guide-is-silent-on-open-by-default-result-schemas.md`
  SHA-256: `e1436f92df0963bd44fa6611c2f7bcdd0270295d0e9b77ab84e0f4fc7813b240`
- `docs/problems/README.md`
  SHA-256: `0bc92d3020457c90405d36ae9db621a5e2c22dcd0e973a9861294e6a3eff6a16`
- `docs/problems/README-history.md`
  SHA-256: `7dc4d2cfdbde2cf005a31255e81f401efd00a79ebd39671fa278c98658ba5b62`

## Problem 002 fix — backlog records, second review of the day

Reviewed: the Problem 002 ticket after its rewrite for the marker-label fix, the
Problem 004 ticket after one bullet and one task were added to it, the problem
backlog index, and the backlog index history file.

The reviewer returned 16 findings: 11 to fix before commit and 5 optional. All
16 were applied.

A Jobs To Be Done review then found three further issues, and fixing two of them
added new prose these documents had not been reviewed for. Recording a review
digest over unreviewed text would be the same kind of empty attestation this
ticket exists to correct, so the new passages went back for a second pass. That
pass returned ten more findings — five to fix before commit, five optional — and
all ten were applied. Two were accuracy defects introduced by the first round of
fixes: the text claimed the release gate requires an exact sentence that the
regular expression actually makes optional, and it omitted the package lines
from the list of what the gate still freezes. A third corrected a judgement. The
text had called the 2026-09-19 release stop "false"; it was not. The record was
genuinely stale, so the check did its job. What was wrong was the implication
that the release was broken.

Nothing is outstanding on these four documents.

Four of the findings were about honesty rather than readability, and they are
worth naming because the ticket under review is itself about a control that
implied more certainty than it had.

- The ticket claimed a neighbouring defect was "tracked separately" when no
  ticket covers it. It now says plainly that the defect is not captured yet.
- The ticket said the fix had "landed on `main`" while it was still uncommitted
  on a branch. It now describes how to find the commit instead of asserting a
  state that was not yet true.
- The ticket counted how many places spell out one file path, and the count was
  already stale, because this same fix added two more. The count was recounted
  and corrected in both tickets that carry it.
- The backlog index summarised the fix as checking "the marker contract" when
  the fix deliberately checks only the labels. Both the index line and the
  verification queue entry now say labels.

Two findings were about pre-existing problems rather than this change: an empty
table that read as a rendering fault, and an archived line filed under the wrong
date. Both were repaired rather than left for the next reader.

One finding moved a heading. Because this ticket exists because a heading move
broke a parser, the backlog reconciler was run afterwards rather than trusted to
be unaffected. It exited cleanly.

- `docs/problems/verifying/002-release-readiness-verifier-only-tests-fixture-like-stable-pass-marker.md`
  SHA-256: `facbf90b58da628acd462fefcc823211d22feac22fdc977259346b98a3d04966`
- `docs/problems/open/004-problem-backlog-parser-couples-to-an-unexplained-exact-heading.md`
  SHA-256: `c4a0680df4765d417e67e2d1b3e8423a7367e4ab5c0aab1a7cc1b6cb3cd90be1`
- `docs/problems/README.md`
  SHA-256: `55739e1292b81bfe93148a7dd479b7fb5cfb573f71c957a3083450412ae34a4d`
- `docs/problems/README-history.md`
  SHA-256: `af75b6f71106546768ba7f05a2331c26e71f0e1ce0eecc3fc76a10c214aa29a6`

## Problem 008 capture — third review of the day

Reviewed: the newly captured Problem 008 ticket in full, the two edited lines in
Problem 004, the two rewritten bullets in Problem 002, the backlog index, and
the index history file.

The reviewer returned 19 findings: 17 to fix before commit and 2 optional. All
19 were applied. Two of them were factual corrections, and both were verified
against the source before being applied rather than taken on the reviewer's
word.

- Problem 002 cited two continuous-integration runs as evidence that the new
  check runs. One of them passed by skipping all its work, so it proved nothing.
  Only the run that executed the test suite supports the claim, and the record
  now says so.
- Problem 002 also gave the wrong reason for that job being skipped. The
  workflow runs it when changesets are pending or a publication is due; the run
  had neither. The original wording named only changesets, which would have sent
  the next reader looking for the wrong thing.
- Problem 008 described the release check as comparing against the Changesets
  plan. At release time it compares against the set captured in
  `release-artifacts/registry-before.json`; the plan comparison is the separate
  release-pull-request path. This matters because the ticket is about deriving
  the list instead of retyping it, so naming the wrong source would mislead
  whoever does the deriving.

Four further findings were about a ticket overstating its own case. Problem 008
argues that a control claims more certainty than it has, so it cannot itself
blur judgement into fact. It had generalised a single observation into standing
practice, asserted that nothing was wrong with the packages when the check had
assessed nothing about them, settled a question its own investigation task
leaves open, and called the transcription "not knowledge" — a verdict dressed as
an observation. All four now mark the reporter's reading as a reading.

One finding concerned a placeholder. The new ticket left its symptoms section
deferred while the description already recorded the observed failure. For a
ticket about not claiming more than the evidence supports, understating its own
evidence is the same fault pointed the other way. The section is now filled.

Two findings proposed splitting the priority and effort header fields across
several lines. The substance was applied — both now read plainly and neither
refers forward to a term the reader has not yet met — but they were kept on one
line each, because the backlog reconciler parses those fields and a multi-line
value risks the exact breakage Problem 004 records. The reconciler was run
afterwards and exited cleanly.

- `docs/problems/open/008-release-package-list-is-transcribed-by-hand-into-the-readiness-record.md`
  SHA-256: `497ced694dd9d751a4ba38d1ff3d6f05de2f7271af9b6e1af6c3c5a9275cd03e`
- `docs/problems/open/004-problem-backlog-parser-couples-to-an-unexplained-exact-heading.md`
  SHA-256: `e6cc2a89b05ddbf392d4665cb090956a7448fe519c05aa5a545185a3423d0adc`
- `docs/problems/verifying/002-release-readiness-verifier-only-tests-fixture-like-stable-pass-marker.md`
  SHA-256: `fd55a21609a6b35b78c7afbed0a94fbc8ef4a1d4be6d7f9c76a93632d6fc18c9`
- `docs/problems/README.md`
  SHA-256: `48b1aad8263bb8ff8a8d7bbdda0c309ee5affdacab7b8793d741d137d0ce7dc6`
- `docs/problems/README-history.md`
  SHA-256: `ce49fa73f623ff5270f71ffd85c38e85e018aefdba671071f83393b79ff8e502`

## Release notes for opening first-party result schemas

Reviewed: the two release notes shipping the change that opens the first-party
published result schemas.

The reviewer returned 15 findings: 10 to fix before release and 5 optional. All
15 were applied.

Architecture review then found the pair asymmetric. Both notes needed to disclose
that a runtime check gets weaker, and only one did. The missing disclosure made
the other note's "What did not change" section read as a claim that nothing
behavioural had moved, which was not true: two exported functions that used to
reject an undeclared key now drop it silently. A section was added, and because
it was text nobody had reviewed, it went back for a third pass rather than being
covered by a digest over unread prose. That pass returned three findings, all
applied. One mattered: the remedy named only one of the two functions its own
heading invites in, leaving the readers most likely to be handling untrusted
payloads with a disclosure and no usable instruction.

Four were about the notes failing their own purpose. A heading reading "What did
not change" sat directly above a paragraph describing a change, which would have
told a backend implementer to skip the one paragraph written for them. The word
"open" was never defined, though "closed" was. The sentence carrying the whole
explanation rested on two words the reader had not been given — "mechanism" and
"spelling", the second of which reads as orthography to anyone meeting it in a
second language. And none of the headings named an action, so a reader scanning
for what to do found only topic labels.

Two concerned the awkward part. These notes have to tell adopters that the
previous release's note implied this surface was settled, and that it was not.
The first draft spent its opening sentences establishing that the earlier note
had been correct before admitting there was a second break waiting. That reads
as a defence. The section now leads with the consequence and explains
afterwards.

One finding asked for something the draft had withheld. The note discloses that
a diagnostic check gets weaker for backend implementers, but gave them nothing
to do about it. It now names the remedy.

The reviewer also confirmed a gap that turned out not to be one: the change
touches a copyable example, which ships no release note. That package is private
and excluded from publication, so none is owed.

- `.changeset/open-first-party-result-schemas.md`
  SHA-256: `8bd3812f045e2d51c66cb3e5654cc4b7b21c3bc6e06ceb461dfacbfaf8118d4e`
- `.changeset/open-feedback-result-schemas.md`
  SHA-256: `4080d5fbddebcebf7eb09332b7134bb64de84ed6e2f0cb4dd55d82b71683197d`

## Release notes and readiness record for opening first-party result schemas

Reviewed: the two amended release notes, the new starter-packages note, and this
release's readiness record.

The reviewer returned 19 findings, 11 to fix before release and 8 optional, plus
one raised outside the scope it was given. All 11, six of the optional ones, and
the out-of-scope finding were applied. The two optional findings left are noted
at the end.

The out-of-scope finding was the most important thing in the review, and it was
raised because the reviewer had read a backlog record the brief did not mention.
Both release notes told adopters that a schema declared strict still publishes
closed. That is false in one real case: a strict schema fed from an open object
has its closure dropped and publishes open. It is a known defect, recorded as
Problem 006 and not fixed here. Shipping that sentence would have repeated the
exact mistake these notes exist to own — stating a rule that is true of the rule
and not of a real case, which is what left adopters stranded after 0.15.0. Both
notes now disclose the exception, and the readiness record lists it as a limit.

Four findings concerned this release's central claim. The notes answer "will
this happen again" with two tests, and the reviewer verified the tests exist and
do what the prose says. But the claim was wider than the tests — "every result
schema this project publishes" against tests covering the result view and five
tools — and the check it offered was two repository paths an adopter who
installed a package will never open. The claim is now bounded to the surfaces
the tests cover, states plainly that a schema added elsewhere later is not
covered, and adds a check the reader can run against their own captured
baseline.

Three findings caught this record overstating itself. It said architecture
review had confirmed no deliberate closed declaration changed meaning, which
reads as a verified universal and is contradicted by Problem 006. It omitted
Problem 006 from its limits entirely. And it described the accessibility review
by naming two findings that were fixed, while that review had also returned
findings on earlier records that were not applied. All three are corrected.

The reviewer also flagged that the digest recorded for this record in an earlier
section of this file no longer matched, because the record was rewritten after
that review. The entry below supersedes it.

Two optional findings were not applied. One asked for the shared paragraph in
the two release notes to open on a different sentence in each, so each leads
with the surface its own reader uses; keeping the two notes identical was judged
the better trade, as the reviewer noted it would be. One asked for wording
changes to a sentence that the applied findings had already replaced.

- `.changeset/open-first-party-result-schemas.md`
  SHA-256: `3565a85644fcd6da6aebfd27cc08c8df662623c78903f61d2324ebe849fa0929`
- `.changeset/open-feedback-result-schemas.md`
  SHA-256: `772bf4876d78e9bf2f6cffa53d27e559bb38701a9d389b30575ef2c355d8cba5`
- `.changeset/initializers-follow-open-result-schemas.md`
  SHA-256: `b750fa00544d7c0fad8cdf2471dac68aabcea753680b92656ad446260402779c`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `e96a51d7abcf265ac8d81b34dea0b44943135ce432a13e99fd1eae45d2c7082e`

## Correction to the feedback release note after a simplification

The maintainer directed that the feedback package should not carry both a strict
schema for checking what an adapter returns and a separate open schema for
publishing the same result, and then directed a fix for a defect an earlier
review had surfaced. Both changed what this note had to say, and the note was
wrong four times before it was right. Recording every attempt, because the
pattern is the point and the final wording is not the interesting part.

The original sentence said the schemas checking an adapter's return were still
strict at the top level. The simplification made that false for a submission
backend. The first repair said anything unexpected from a submission backend was
dropped quietly; risk review found every event was still checked strictly, so
that was false too. The second repair enumerated four cases; a specialist review
ran the compiled package and found the enumeration incomplete, because the page
and thread schemas had opened in this release as well. The third repair stopped
enumerating losses and stated only what survived, which was sound.

Then the defect fix changed the behaviour underneath it, and the fourth failure
was the most instructive. The note claimed events could no longer fail a
recorded submission. The reviewer did not take that on trust: it built the
package, started a real server, and probed cases the note did not mention. Two
of them still failed a recorded submission — a backend returning more than a
hundred events, and one returning something that was not a list. The list's
shape and size were still being checked at the fatal point. So the note was
describing a fix that was not finished, and the defect was in the code, not only
in the prose.

Hook dispatch is now total: its whole body runs inside one guard, so nothing an
adapter returns in the event position can fail a call for work it has already
committed. Eight tests in
`packages/feedback/test/durable-record-survives-bad-event.test.mjs` pin that
across the four tools that dispatch hooks, covering what is in an event, whether
a list was sent at all, how many, and a container that throws when it is read. A
ninth test in the same file pins that a submission backend's stray top-level key
is dropped, which is a different property.

That paragraph has now been corrected twice, and the corrections are more
instructive than the final wording. It first claimed six tests where five
existed. Risk review caught it, after the wrong number had already been repeated
into a briefing. The fix was to add the missing test rather than lower the
claim, because the gap was real: every test then drove the submission tool, so a
change scoped to a conversation result schema could have brought the defect back
on a durable-write path with the suite green.

The next round caught the repaired sentence twice more. The count was now true of
the file but reached by counting a test that pins something else. And the new
test covered two of the four tools that dispatch hooks — thread creation and
reading — leaving the one that appends a message unpinned. A test for that path
was added rather than the claim narrowed, for the same reason as before.

A fourth round found the same thing once more, and that is what finally changed
the approach. The guard had been moved outward a statement at a time across
three rounds, and each round left exactly one read outside it — most recently the
loop itself, which a subclass can make throw by overriding how it is iterated.
Guarding statement by statement was the wrong shape. The whole body now runs
inside one guard, which makes the property true by construction rather than by
enumeration, and a test drives a container built to throw when read. That test
was watched failing against the previous version before being kept.

A fifth round found one more, and it was the one that stopped the loop. The
guard is total within hook dispatch, but `events` is a declared key of the result
schemas, so the parse reads the property before the guarded code runs. A backend
exposing it as a getter that throws still fails a call for committed work. The
obvious repair collides with a check this project deliberately keeps, so it was
not attempted under release pressure — attempting intricate repairs under
pressure is how the previous five defects arrived. The claim in the release note
was narrowed to what the code actually does, the open case is stated there for
adopters rather than left to be discovered, and it is captured as Problem 009
along with the two neighbouring cases the reviews surfaced.

Two further defects were fixed in those rounds. The line that builds an event
for a hook spreads a value an adapter handed us, and a spread runs getters, so a
value with a throwing getter could have failed a call for committed work. That
was guarded — and then the following round found the guard was placed one level
too deep: reading the length of the value, and taking a copy of it, run before
the guard, and neither is safe on a proxy wrapping an array or on a subclass
that overrides how it is copied. Both reads are now inside the guard.


Four other findings were applied. The remedy pointed readers at a strict wrapper
around this package's exported schemas, which is exactly what the package itself
does and exactly why the check disappeared. The surviving-check sentence
undercounted. The catch-all conflated losing a key with losing a whole event,
which cost the reader more. And the phrase "checked where a failure is
survivable" was the author's own reasoning leaking into text meant for someone
else, describing a call site rather than anything a reader could observe.

Three optional findings were applied: the backend returns a receipt rather than
the feedback, the fix covers the conversation tools too, and a hook may now
silently never run — which is the one consequence a backend implementer should
act on and the note had not stated.

One was not applied. The surviving strict check is pinned for one of the four
conversation methods rather than all four. The claim is true of all four by
reading, and one is pinned by test; widening the coverage is worth doing and is
not worth holding the release for.

- `.changeset/open-feedback-result-schemas.md`
  SHA-256: `a7405293da84b643b9e280c66c3e73cbe352e2df7aec53fa465481de62e9ee69`

## Problem 009 and the narrowed event claim

Reviewed: the newly captured Problem 009, the section of the feedback release
note that describes the durable-write fix, and the backlog index and its history.

Nine findings, five to fix before release and four optional. All five and three
of the four optional ones were applied. The one left is a heading that announces
a submission fix while the section also covers the conversation tools; changing
it would break the reference by which this section has been identified across
seven review rounds, and the section names all four tools in its body.

This was the first round on that section to find no factual error. The reviewer
probed the schema library directly to confirm the one open case is real and is
the only remaining one, rather than reading the code and inferring.

What it did find was a scope defect and an actionability defect. The note
disclosed the open case in terms only someone who had read our parser would
recognise — "the events property throws when we read it" — where a backend
author can only check their own code for a getter or a proxy. And the sentence
bounding what the fix covers gave two examples drawn from the submission
receipt, immediately after a paragraph saying the behaviour applies to the three
conversation tools as well, where far more can still fail a call after a durable
write. Both are corrected.

The ticket had the same fault in a different place. Its summary said everything
about events was handled, which contradicted the first of the three cases it
then describes. And its third case had inherited the framing of the first two: it
was described as needing an unusual adapter and as causing duplicate work on
retry, when it needs only a support thread that grows past two hundred messages,
and retrying never helps because every read fails from then on. The priority
rationale carried the same wrong claim and was corrected without moving the
score, which the reviewer said plainly it would not pretend was well argued.

- `docs/problems/open/009-a-tool-call-can-fail-after-the-backend-has-recorded-the-work.md`
  SHA-256: `e6fc7b54ce00da45d69847d4b021d3c714130cd7a7219b16c40807e645274686`
- `.changeset/open-feedback-result-schemas.md`
  SHA-256: `0f4fa6abfcfb3961d500397b91d3865867944c9eb942faafcb31fcc431eee7ba`
- `docs/problems/README.md`
  SHA-256: `eb6b2348fe37384e4f806d456772da210badeeceaefb6a2dbc06b48c2f16c96d`
- `docs/problems/README-history.md`
  SHA-256: `28ae9f0b2ec761488c7be284cd537b0cf1b63e1703581740352b2d873e15fc92`

## Two release tickets captured after the 0.16.0 release

Reviewed: Problem 010 and Problem 011, both captured immediately after the
release that exposed them, and the backlog index and its history.

Two rounds. The first returned sixteen findings and the second, on a rewritten
Problem 010, returned eleven. All were applied. Both rounds were worth more than
the wording they corrected, because both found the tickets wrong about facts
that were checkable in minutes.

The first round overturned Problem 010's diagnosis entirely. The ticket said the
publishing tool and the registry had disagreed, and that the cause lay outside
this project. The reviewer pulled the registry's own timestamps and the run
logs: the tool had reported the truth, every version did appear, and this
project's verifier had simply stopped waiting after three minutes when the last
package took five. The ticket had also credited a re-run with fixing it; the
re-run published nothing and said so in its log, twenty-seven minutes after the
gap had closed on its own. And it counted three affected packages where twelve
pin the missing version. The ticket was rewritten, its title changed, and its
effort dropped from medium to small, because the fix turned out to be a number
rather than a design.

The second round found the rewrite still wrong about who was hurt. It rested
the impact on twelve packages pinning the missing version, without noticing that
in all twelve it is a development dependency an ordinary consumer never fetches.
Meanwhile the one genuine consumer-facing failure was absent: the feedback
package depends on the server package at runtime, and was served a minute and a
half before it. That install could not resolve, and the ticket had not mentioned
it. The reviewer also measured the window from the wrong event, making it about
half its real length, and flagged that the quoted source was a paraphrase in a
ticket whose previous version had failed on that same kind of slippage.

Problem 011 needed corrections of a different kind. Its symptoms described a
sequence its own stated mechanism could not produce, it attributed the behaviour
to the wrong function, its proposed fix reproduced the staleness it was meant to
remove, and it pointed a reader at files that do not contain the text it quoted.
All corrected. Its account of the control being bypassed was left untouched:
both reviewers said it states that plainly and should not be softened.

A third round, by risk review rather than accessibility review, found the same
class again. The rewrite had gone from twelve wrongly-counted packages to one
correctly-counted one, and one was still wrong: the React and Svelte packages
carry the identical exact runtime pin on the server package and were both served
before it. Checking exhaustively rather than by sample found four packages with
that pin, three of which were briefly unresolvable — the fourth was published
after the dependency and never was. Three drafts, three wrong answers to the
same question, each one closer. The ticket now states the method as exhaustive
so the next reader can check it rather than trust it, and marks which figures
are deduced from manifests and timestamps rather than observed.

That round also found the starter-install reasoning derived from the wrong file:
it argued from the published initializer's manifest rather than from the
template manifest a created project actually installs, which is built by a
script that moves dependencies between the two. The conclusion held, the
argument did not, and it missed that the generated project's runtime dependency
was also briefly missing.

On Problem 011 it found the ticket leaning on "the score was within appetite" to
carry an implication it had not earned. A score bound to a different checkout is
not weak evidence that the released tree was assessed; it is the absence of that
evidence, which is the whole point of the binding check. The ticket now says the
release went outside both authorised bypass paths, and its workaround no longer
presents the ungated terminal as a fallback option. It also claimed the branch
check adds nothing over the commit check, which is not quite true — it excludes
a detached HEAD and a coincidentally-equal branch.

A fourth round found the corrections applied to one section and not the rest.
The Description had the right numbers; the priority rationale, the impact
assessment and the cross-reference to the release risk still carried the figures
from before the correction, and each of those is a section a triage reader
reaches first. It also found the generated-project enumeration short again — the
template build carries non-starter development dependencies through, so a
created project needed four missing versions rather than two — and two places in
Problem 011 where a remediation had been reported as applied while the original
sentence was still in the file.

Four drafts of one ticket, each understating the same thing in the same
direction, each caught by someone else. The pattern is worth more than the
ticket: nothing in this repository checks whether a problem record's
enumeration is complete, so the only control is a reader who goes and counts.

A fifth round found one more of the same: both user-interface starters list the
Tailwind package as a runtime dependency of the project they create, and the
enumeration did not name it — while a sentence one paragraph below foreclosed
the check by saying the starters declare no runtime dependencies of their own,
which is true of the published starter and not of what it generates. That
package was not in this release, so no figure was wrong, but it is named now
because the list is meant to be re-checkable.

- `docs/problems/open/010-the-release-gives-up-waiting-before-the-registry-catches-up.md`
  SHA-256: `b6c77014cade1cc2d6729fe4ec665a3dbcce2cb0f5ac35ee5fb873355483cd08`
- `docs/problems/open/011-the-release-risk-gate-cannot-be-satisfied-from-a-worktree.md`
  SHA-256: `d03acf5164260d8da3b1356eb3e4fa2c996701a906ca227d708d51b275e4f831`
- `docs/problems/README.md`
  SHA-256: `a2cd3f9b029d4776c9634a59394a17adc9a873f904dcad720e55070ab9300968`
- `docs/problems/README-history.md`
  SHA-256: `82d293ec9f1600762a38ce1d1ca5b1e85a00e12048ff6b46cee0a1307b9f12ab`

## ADR-0098, Publish on Merge to a Publish Branch

Three cognitive-accessibility rounds on one decision record, and each one changed
what the record says rather than how it says it.

The first round found the record claiming a mechanism and claiming the benefit
of not having it. The draft reconciled the release branch onto the trunk before
publishing, copied from the reference implementation, while also claiming the
trunk stayed untouched until the packages existed. Both could not be true.
Reading the reference settled it: its two reconciliation jobs run the same
script against the same commit, and that script pushes to the trunk. The shape
was changed to merge back only after publishing, which makes the claim true. The
same round found the opening sentence asserting that a release publishes every
publishable package, which the record contradicts four pages later, and found
the attempt and failure counts not adding up.

The second round found the record's own reframing carried a price it had not
recorded. Treating the website deploy as part of the publication step means a
failed deploy blocks the merge back, and the reference implementation keeps
website deployment separate precisely so a website failure cannot block a
release. The record named that departure and costed it nowhere.

The third round found a hole in the shape. Step two was dispatched once, when
the release pull request opened, while the tool that maintains that pull request
rewrites it on every further push to the trunk. A release could publish packages
built from a superseded commit, and the confirmation criterion counted one build
per pull request, which passes in exactly that case.

Across all three the same shape of error recurs: the record asserts a conclusion
where a reader decides, and supports it somewhere else or not at all. The
preamble listed three commitments where the body carried seven. The options
table listed three costs where the consequences carried five. The one-step
framing was asserted twice and argued neither time, against a reference
implementation that takes the opposite view for a stated reason. None of these
is a wrong fact. Each is a place where a maintainer reading for a yes or no
would decide on less than the record knows.

Architecture review then found the record understating its own scope four times
over, and the last of those is the one worth carrying forward. Retiring the
release workflow drops far more than publishing: registry readback, integrity
and provenance capture, a clean-install smoke test, signature auditing,
initializer container verification, registry-sourced guide checks, per-package
tags and per-package releases. A ratified decision requires that readback and it
exists nowhere else. The record had accounted for three consequences of
retirement and there were a dozen. Naming a thing as retired is not the same as
knowing what it did.

The last round of that scope work produced a finding worth stating on its own.
Two of the rehomed checks install by dist-tag rather than by version, so running
them before promotion would have fetched the previous release. One of them
compares the generated project only against itself, so it would have passed
while verifying nothing. A gate that reports success on the wrong artifact is
worse than the gap it was added to close, and nothing in the record's own
confirmation criteria would have shown it: the criterion reads as satisfied
either way. Re-checkability is not a property of the wording. It is a property
of what the check resolves.

Two defects in this record were mine and not the author's judgement. A
line-wrapping script merged two consequence bullets, deleting one as a
top-level item, and dropped the word "without" from a claim about continuous
integration runs, reversing its meaning. Neither was caught by the repository's
checks, because neither the decisions compendium nor its consistency check reads
list structure. Both were caught by review. The wrapping was redone with a
marker-aware pass and the result verified word-for-word identical to its input.

- `docs/decisions/0098-publish-on-merge-to-a-publish-branch.proposed.md`
  SHA-256: `c05277bd578b82da4cbb009099b957774cee1075908ebb7bd1081bf689cb0243`
- `docs/decisions/README.md`
  SHA-256: `17ab0391650a83ebd99df31782c780d4381d10f01113c74724a9429de64226f0`
