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
