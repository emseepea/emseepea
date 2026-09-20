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
